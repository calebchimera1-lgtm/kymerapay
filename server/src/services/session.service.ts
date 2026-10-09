import { randomUUID } from 'node:crypto';
import { prisma, type DbClient } from '../config/database.js';
import { env } from '../config/env.js';
import { SECURITY } from '../config/security.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { AppError } from '../utils/AppError.js';
import { randomToken, sha256 } from '../utils/crypto.js';
import type { RequestContext } from '../utils/requestContext.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { createNotification } from './notification.service.js';

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export const REVOKE_REASONS = {
  ROTATED: 'ROTATED',
  LOGOUT: 'LOGOUT',
  EXPIRED: 'EXPIRED',
  REUSE_DETECTED: 'REUSE_DETECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

/** Identifies a browser install for "new device" alerts. Not a security boundary. */
export function deviceFingerprint(context: RequestContext): string | null {
  if (!context.deviceId && !context.userAgent) return null;
  return sha256(`${context.deviceId ?? ''}|${context.userAgent ?? ''}`);
}

/** Creates a session and returns its opaque refresh token (only the hash is stored). */
export async function createSession(
  db: DbClient,
  userId: string,
  context: RequestContext,
  familyId: string = randomUUID(),
) {
  const refreshToken = randomToken();
  const session = await db.session.create({
    data: {
      userId,
      familyId,
      refreshTokenHash: sha256(refreshToken),
      deviceFingerprintHash: deviceFingerprint(context),
      userAgent: context.userAgent,
      ip: context.ip,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  return { session, refreshToken };
}

export interface RotationResult {
  userId: string;
  sessionId: string;
  /** New refresh token to set as the cookie, or null when the browser already holds it. */
  refreshToken: string | null;
  refreshExpiresAt: Date;
}

class RotationRaceError extends Error {}

const sessionEnded = () =>
  AppError.unauthenticated('Your session has ended. Please sign in again.');

/**
 * Exchanges a refresh token for a new one (rotation). Presenting an already
 * rotated token outside the grace window is treated as theft: the whole
 * session family is revoked and the user is alerted.
 */
export async function rotateSession(
  refreshToken: string,
  context: RequestContext,
  attempt = 0,
): Promise<RotationResult> {
  const now = new Date();
  const current = await sessionRepository.findByTokenHash(prisma, sha256(refreshToken));
  if (!current) throw sessionEnded();

  if (current.revokedAt) {
    if (current.revokedReason === REVOKE_REASONS.ROTATED) {
      const withinGrace =
        now.getTime() - current.revokedAt.getTime() < SECURITY.refreshReuseGraceSeconds * 1000;
      const replacement =
        withinGrace && current.replacedById
          ? await prisma.session.findUnique({ where: { id: current.replacedById } })
          : null;
      if (replacement && !replacement.revokedAt && replacement.expiresAt > now) {
        // Concurrent refresh from another tab: the browser already has the newer cookie.
        return {
          userId: replacement.userId,
          sessionId: replacement.id,
          refreshToken: null,
          refreshExpiresAt: replacement.expiresAt,
        };
      }
      if (!withinGrace) await handleTokenReuse(current.userId, current.familyId, context);
    }
    throw sessionEnded();
  }

  if (current.expiresAt <= now) {
    await sessionRepository.revoke(prisma, current.id, REVOKE_REASONS.EXPIRED);
    throw sessionEnded();
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const next = await createSession(tx, current.userId, context, current.familyId);
      const claimed = await tx.session.updateMany({
        where: { id: current.id, revokedAt: null },
        data: {
          revokedAt: now,
          revokedReason: REVOKE_REASONS.ROTATED,
          replacedById: next.session.id,
          lastUsedAt: now,
        },
      });
      // Another request rotated this token first; roll back and take the grace path.
      if (claimed.count === 0) throw new RotationRaceError();
      return {
        userId: current.userId,
        sessionId: next.session.id,
        refreshToken: next.refreshToken,
        refreshExpiresAt: next.session.expiresAt,
      };
    });
  } catch (err) {
    if (err instanceof RotationRaceError && attempt === 0) {
      return rotateSession(refreshToken, context, attempt + 1);
    }
    if (err instanceof RotationRaceError) throw sessionEnded();
    throw err;
  }
}

async function handleTokenReuse(userId: string, familyId: string, context: RequestContext) {
  await prisma.$transaction(async (tx) => {
    await sessionRepository.revokeFamily(tx, familyId, REVOKE_REASONS.REUSE_DETECTED);
    await recordAudit(tx, {
      action: AUDIT_ACTIONS.SESSION_REUSE_DETECTED,
      actorId: userId,
      entityType: 'session',
      entityId: familyId,
      context,
    });
    await createNotification(tx, {
      userId,
      type: 'SECURITY',
      title: 'We signed you out for your safety',
      body: 'An old sign-in token was reused, so we ended that session. If this was not you, change your password.',
    });
  });
}
