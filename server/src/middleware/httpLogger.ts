import type { IncomingMessage, ServerResponse } from 'node:http';
import { pinoHttp } from 'pino-http';
import { logger } from '../utils/logger.js';

/** Access log. Logs method, path, status and timing — never bodies. */
export const httpLogger = pinoHttp({
  logger,
  // Reuse the correlation ID assigned by the requestId middleware.
  genReqId: (req: IncomingMessage) => req.id,
  autoLogging: { ignore: (req) => req.url === '/api/health' },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req: { id: string; method: string; url: string }) => ({
      id: req.id,
      method: req.method,
      url: req.url,
    }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
