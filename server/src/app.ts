import cookieParser from 'cookie-parser';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { httpLogger } from './middleware/httpLogger.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { requestId } from './middleware/requestId.js';
import { apiRouter } from './routes/index.js';

/**
 * Builds the Express application without binding a port, so tests can drive
 * it in-process with supertest.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY);

  app.use(requestId);
  app.use(httpLogger);
  // The API serves JSON only, so the strictest helmet defaults apply.
  app.use(helmet());
  app.use(corsMiddleware);
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.use('/api', apiRateLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
