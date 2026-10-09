import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const allowedOrigins = new Set(env.CLIENT_URL);

/**
 * CSRF defence for the endpoints authenticated by the refresh cookie
 * (/auth/refresh, /auth/logout). The cookie is already SameSite=Strict; in
 * addition we require a custom header — which a cross-site form cannot send
 * and which forces a CORS preflight for scripts — and, when the browser
 * reports an Origin, that it is one of ours.
 */
export const requireCsrfHeader: RequestHandler = (req, _res, next) => {
  if (req.get('X-Requested-With') !== 'XMLHttpRequest') {
    throw AppError.forbidden('Missing request verification header.');
  }
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    throw AppError.forbidden('Request origin is not allowed.');
  }
  next();
};
