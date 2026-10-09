import { ERROR_CODES } from '@app/shared';
import { rateLimit } from 'express-rate-limit';
import { AppError } from '../utils/AppError.js';

/**
 * Baseline limiter for the whole API. Stricter per-route limiters (login,
 * money movement) are layered on top of this in later phases.
 *
 * Uses the in-memory store: correct for a single instance. Swap in a shared
 * store (e.g. Redis) before running more than one API instance.
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => {
    next(new AppError(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please slow down.', 429));
  },
});
