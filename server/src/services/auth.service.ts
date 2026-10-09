import {
  ERROR_CODES,
  type AuthSession,
  type FieldIssue,
  type RegisterBusinessData,
  type RegisterUserData,
} from '@app/shared';
import { prisma } from '../config/database.js';
import { SECURITY } from '../config/security.js';
import { Prisma, type Role, type User } from '../generated/prisma/client.js';
import { toAuthUser } from '../mappers/user.mapper.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { userRepository, type UniqueUserField } from '../repositories/user.repository.js';
import { AppError } from '../utils/AppError.js';
import { sha256 } from '../utils/crypto.js';
import { burnVerification, hashSecret, verifySecret } from '../utils/password.js';
import type { RequestContext } from '../utils/requestContext.js';
import { insertAccount, type BusinessDetails } from './account.service.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { createNotification } from './notification.service.js';
import {
  createSession,
  deviceFingerprint,
  REVOKE_REASONS,
  rotateSession,
} from './session.service.js';
import { signAccessToken } from './token.service.js';

/** What a controller needs to answer an auth request. */
export interface AuthResult {
  auth: AuthSession;
  /** Set as the httpOnly cookie; null means "leave the current cookie as is". */
  refreshToken: string | null;
  refreshExpiresAt: Date;
}

const CONFLICT_ERRORS: Record<
  UniqueUserField,
  { code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES]; message: string }
> = {
  username: { code: ERROR_CODES.USERNAME_TAKEN, message: 'That username is already taken.' },
  email: { code: ERROR_CODES.EMAIL_TAKEN, message: 'An account with this e-mail already exists.' },
  phone: {
    code: ERROR_CODES.PHONE_TAKEN,
    message: 'An account with this phone number already exists.',
  },
};

function conflictError(fields: UniqueUserField[]): AppError {
  const details: FieldIssue[] = fields.map((field) => ({
    path: field,
    message: CONFLICT_ERRORS[field].message,
  }));
  const first = CONFLICT_ERRORS[fields[0]!];
  return new AppError(first.code, first.message, 409, details);
}

const invalidCredentials = () =>
  new AppError(
    ERROR_CODES.INVALID_CREDENTIALS,
    'Incorrect e-mail, phone, username or password.',
    401,
  );

function lockedError(until: Date): AppError {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return new AppError(
    ERROR_CODES.ACCOUNT_LOCKED,
    `Too many failed sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    423,
  );
}

const suspendedError = () =>
  new AppError(
    ERROR_CODES.ACCOUNT_SUSPENDED,
    'This account has been suspended. Contact support for help.',
    403,
  );

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

async function buildAuthSession(userId: string, sessionId: string): Promise<AuthSession> {
  const user = await userRepository.findByIdWithProfile(prisma, userId);
  if (!user) throw AppError.unauthenticated();
  if (user.status === 'SUSPENDED') throw suspendedError();

  const { token, expiresAt } = signAccessToken({
    userId: user.id,
    role: user.role,
    sessionId,
    tokenVersion: user.tokenVersion,
  });
  return {
    user: toAuthUser(user),
    accessToken: token,
    accessTokenExpiresAt: expiresAt.toISOString(),
  };
}

interface NewAccount {
  role: Extract<Role, 'USER' | 'BUSINESS'>;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  pin: string;
  business?: BusinessDetails;
}

/**
 * Creates the user, wallet, static QR code, first session and audit entry in
 * one database transaction — an account is never left half-created.
 */
async function createAccount(account: NewAccount, context: RequestContext): Promise<AuthResult> {
  const unique = { username: account.username, email: account.email, phone: account.phone };
  const taken = await userRepository.findTakenFields(prisma, unique);
  if (taken.length > 0) throw conflictError(taken);

  const [passwordHash, pinHash] = await Promise.all([
    hashSecret(account.password),
    hashSecret(account.pin),
  ]);

  try {
    const { user, session, refreshToken } = await prisma.$transaction(async (tx) => {
      const created = await insertAccount(tx, {
        ...unique,
        role: account.role,
        fullName: account.fullName,
        passwordHash,
        pinHash,
        ...(account.business ? { business: account.business } : {}),
      });
      const issued = await createSession(tx, created.id, context);
      await recordAudit(tx, {
        action:
          account.role === 'BUSINESS'
            ? AUDIT_ACTIONS.BUSINESS_REGISTERED
            : AUDIT_ACTIONS.USER_REGISTERED,
        actorId: created.id,
        entityType: 'user',
        entityId: created.id,
        context,
      });
      return { user: created, ...issued };
    });

    return {
      auth: await buildAuthSession(user.id, session.id),
      refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  } catch (err) {
    // Lost a race with a concurrent registration for the same handle/e-mail/phone.
    if (isUniqueViolation(err)) {
      const raced = await userRepository.findTakenFields(prisma, unique);
      if (raced.length > 0) throw conflictError(raced);
    }
    throw err;
  }
}

async function registerFailedLogin(user: User, context: RequestContext): Promise<never> {
  const { failedLoginCount } = await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });

  if (failedLoginCount >= SECURITY.maxFailedLogins) {
    const lockedUntil = new Date(Date.now() + SECURITY.loginLockMinutes * 60_000);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { lockedUntil, failedLoginCount: 0 },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.LOGIN_LOCKED,
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
        context,
        metadata: { lockedUntil: lockedUntil.toISOString() },
      });
      await createNotification(tx, {
        userId: user.id,
        type: 'SECURITY',
        title: 'Sign-in temporarily locked',
        body: `We blocked sign-in for ${SECURITY.loginLockMinutes} minutes after several incorrect password attempts.`,
      });
    });
    throw lockedError(lockedUntil);
  }

  await recordAudit(prisma, {
    action: AUDIT_ACTIONS.LOGIN_FAILED,
    actorId: user.id,
    entityType: 'user',
    entityId: user.id,
    context,
    metadata: { failedLoginCount },
  });
  throw invalidCredentials();
}

export const authService = {
  register(input: RegisterUserData, context: RequestContext): Promise<AuthResult> {
    return createAccount({ ...input, role: 'USER' }, context);
  },

  registerBusiness(input: RegisterBusinessData, context: RequestContext): Promise<AuthResult> {
    const { username, email, phone, password, pin, ...business } = input;
    return createAccount(
      {
        role: 'BUSINESS',
        fullName: business.businessName,
        username,
        email,
        phone,
        password,
        pin,
        business,
      },
      context,
    );
  },

  async login(identifier: string, password: string, context: RequestContext): Promise<AuthResult> {
    const user = await userRepository.findByLoginIdentifier(prisma, identifier);

    if (!user || !user.passwordHash || user.role === 'SYSTEM') {
      await burnVerification(password);
      throw invalidCredentials();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw lockedError(user.lockedUntil);

    if (!(await verifySecret(user.passwordHash, password))) {
      return registerFailedLogin(user, context);
    }

    if (user.status === 'SUSPENDED') {
      await recordAudit(prisma, {
        action: AUDIT_ACTIONS.LOGIN_BLOCKED_SUSPENDED,
        actorId: user.id,
        entityType: 'user',
        entityId: user.id,
        context,
      });
      throw suspendedError();
    }

    const fingerprint = deviceFingerprint(context);
    const { session, refreshToken } = await prisma.$transaction(async (tx) => {
      const isNewDevice = fingerprint
        ? !(await sessionRepository.hasSessionWithFingerprint(tx, user.id, fingerprint))
        : false;

      await tx.user.update({
        where: { id: user.id },
        data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
      });
      const issued = await createSession(tx, user.id, context);
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.LOGIN_SUCCEEDED,
        actorId: user.id,
        entityType: 'session',
        entityId: issued.session.id,
        context,
        metadata: { newDevice: isNewDevice },
      });
      if (isNewDevice) {
        await createNotification(tx, {
          userId: user.id,
          type: 'SECURITY',
          title: 'New sign-in to your account',
          body: 'Your account was logged in from a new device. If this was not you, change your password now.',
        });
      }
      return issued;
    });

    return {
      auth: await buildAuthSession(user.id, session.id),
      refreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  },

  async refresh(refreshToken: string, context: RequestContext): Promise<AuthResult> {
    const rotated = await rotateSession(refreshToken, context);
    try {
      return {
        auth: await buildAuthSession(rotated.userId, rotated.sessionId),
        refreshToken: rotated.refreshToken,
        refreshExpiresAt: rotated.refreshExpiresAt,
      };
    } catch (err) {
      if (err instanceof AppError && err.code === ERROR_CODES.ACCOUNT_SUSPENDED) {
        await sessionRepository.revoke(prisma, rotated.sessionId, REVOKE_REASONS.SUSPENDED);
      }
      throw err;
    }
  },

  async logout(refreshToken: string | undefined, context: RequestContext): Promise<void> {
    if (!refreshToken) return;
    const session = await sessionRepository.findByTokenHash(prisma, sha256(refreshToken));
    if (!session || session.revokedAt) return;

    await prisma.$transaction(async (tx) => {
      await sessionRepository.revoke(tx, session.id, REVOKE_REASONS.LOGOUT);
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.LOGOUT,
        actorId: session.userId,
        entityType: 'session',
        entityId: session.id,
        context,
      });
    });
  },

  async getMe(userId: string) {
    const user = await userRepository.findByIdWithProfile(prisma, userId);
    if (!user) throw AppError.unauthenticated();
    return toAuthUser(user);
  },
};
