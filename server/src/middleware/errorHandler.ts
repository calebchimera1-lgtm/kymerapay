import { ERROR_CODES, type ApiFailure } from '@app/shared';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

/** Errors raised by express.json() carry an HTTP status and a `type`. */
interface BodyParserError extends Error {
  status?: number;
  type?: string;
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return err instanceof Error && typeof (err as BodyParserError).type === 'string';
}

function toAppError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return AppError.validation(
      err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      return new AppError(ERROR_CODES.INVALID_JSON, 'Request body is not valid JSON.', 400);
    }
    if (err.type === 'entity.too.large') {
      return new AppError(ERROR_CODES.PAYLOAD_TOO_LARGE, 'Request body is too large.', 413);
    }
    if (err.status && err.status >= 400 && err.status < 500) {
      return AppError.badRequest('The request could not be processed.');
    }
  }

  return null;
}

/** Catch-all for unmatched routes. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`Route ${req.method} ${req.path} does not exist.`));
};

/**
 * Converts every error into the standard failure envelope. Unexpected errors
 * are logged with full detail server-side but reach the client only as a
 * generic INTERNAL_ERROR — no stack traces, SQL or internal messages.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);

  if (!appError) {
    logger.error({ err, requestId: String(req.id) }, 'Unhandled error');
  } else if (appError.statusCode >= 500) {
    logger.error({ err, requestId: String(req.id) }, appError.message);
  }

  const status = appError?.statusCode ?? 500;
  const body: ApiFailure = {
    success: false,
    error: {
      code: appError?.code ?? ERROR_CODES.INTERNAL_ERROR,
      message: appError?.message ?? 'Something went wrong on our side. Please try again.',
      requestId: String(req.id),
      ...(appError?.details ? { details: appError.details } : {}),
    },
  };

  if (res.headersSent) return;
  res.status(status).json(body);
};
