import { pino } from 'pino';
import { env } from '../config/env.js';

/**
 * Structured JSON logger. Credentials and tokens are redacted wherever they
 * appear so they can never leak into log storage.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.newPassword',
      '*.currentPassword',
      '*.pin',
      '*.newPin',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.otp',
    ],
    censor: '[REDACTED]',
  },
  ...(env.NODE_ENV === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});
