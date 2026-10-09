import { randomUUID } from 'node:crypto';
import { ERROR_CODES, ROLES, type Role } from '@app/shared';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { durationToSeconds } from '../utils/duration.js';

const ISSUER = 'wallet-api';
const AUDIENCE = 'wallet-web';
const ACCESS_TOKEN_TTL_SECONDS = durationToSeconds(env.JWT_EXPIRES_IN);

export interface AccessTokenClaims {
  userId: string;
  role: Role;
  sessionId: string;
  tokenVersion: number;
}

const payloadSchema = z.object({
  sub: z.uuid(),
  role: z.enum(ROLES),
  sid: z.uuid(),
  ver: z.number().int().nonnegative(),
});

/** Short-lived HS256 access token. Role/status are re-checked against the DB on every request. */
export function signAccessToken(claims: AccessTokenClaims): { token: string; expiresAt: Date } {
  const token = jwt.sign(
    { role: claims.role, sid: claims.sessionId, ver: claims.tokenVersion },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      subject: claims.userId,
      issuer: ISSUER,
      audience: AUDIENCE,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      jwtid: randomUUID(),
    },
  );
  return { token, expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000) };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
    });
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(ERROR_CODES.TOKEN_EXPIRED, 'Your session has expired.', 401);
    }
    throw AppError.unauthenticated();
  }

  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) throw AppError.unauthenticated();
  return {
    userId: parsed.data.sub,
    role: parsed.data.role,
    sessionId: parsed.data.sid,
    tokenVersion: parsed.data.ver,
  };
}
