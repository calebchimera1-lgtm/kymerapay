import cors from 'cors';
import { env } from '../config/env.js';

const allowedOrigins = new Set(env.CLIENT_URL);

/**
 * Only the configured web client origins may call the API from a browser.
 * Credentials are allowed because the refresh token travels in an httpOnly cookie.
 */
export const corsMiddleware = cors({
  origin(origin, callback) {
    // Non-browser clients (curl, server-to-server, same-origin) send no Origin.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Requested-With',
    'X-Request-Id',
    'X-Device-Id',
  ],
  exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 600,
});
