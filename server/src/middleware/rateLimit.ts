import { ERROR_CODES } from '@app/shared';
import { rateLimit, type Options } from 'express-rate-limit';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

/**
 * Uses the in-memory store: correct for a single instance. Swap in a shared
 * store (e.g. Redis) before running more than one API instance.
 */
function createLimiter(options: Pick<Options, 'windowMs' | 'limit'> & { message: string }) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, _res, next) => {
      next(new AppError(ERROR_CODES.RATE_LIMITED, options.message, 429));
    },
  });
}

/** Baseline limiter for the whole API. */
export const apiRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please slow down.',
});

/** Sign-in attempts per IP. Per-account lockout (5 failures) applies on top of this. */
export const loginRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  message: 'Too many sign-in attempts from this network. Try again in a few minutes.',
});

/** Account creation per IP. */
export const registrationRateLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  message: 'Too many accounts created from this network. Try again later.',
});

/** Token refreshes per IP (a healthy client refreshes about every 15 minutes). */
export const refreshRateLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX * 6,
  message: 'Too many session refreshes. Please sign in again shortly.',
});
