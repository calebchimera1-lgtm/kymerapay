import { ERROR_CODES, type Role } from '@app/shared';
import type { Request, RequestHandler } from 'express';
import { prisma } from '../config/database.js';
import { sessionRepository } from '../repositories/session.repository.js';
import { verifyAccessToken } from '../services/token.service.js';
import type { AuthContext } from '../types/express.js';
import { AppError } from '../utils/AppError.js';

/**
 * Requires a valid access token AND a live session. Role, status and token
 * version are read from the database on every request, so suspension,
 * logout and role changes take effect immediately — the token is never the
 * sole source of truth.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get('Authorization');
  const match = header ? /^Bearer ([A-Za-z0-9._-]+)$/.exec(header) : null;
  if (!match) throw AppError.unauthenticated();

  const claims = verifyAccessToken(match[1]!);
  const session = await sessionRepository.findForAuth(prisma, claims.sessionId);

  if (
    !session ||
    session.userId !== claims.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.tokenVersion !== claims.tokenVersion
  ) {
    throw AppError.unauthenticated('Your session has ended. Please sign in again.');
  }
  if (session.user.status === 'SUSPENDED') {
    throw new AppError(ERROR_CODES.ACCOUNT_SUSPENDED, 'This account has been suspended.', 403);
  }

  req.auth = { userId: claims.userId, role: session.user.role, sessionId: session.id };
  next();
};

/** Allows only the given roles. Must run after `requireAuth`. */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) throw AppError.unauthenticated();
    if (!roles.includes(req.auth.role)) throw AppError.forbidden();
    next();
  };
}

/** Typed accessor for handlers mounted behind `requireAuth`. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
}
