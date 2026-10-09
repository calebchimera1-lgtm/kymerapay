import { ERROR_CODES, type ErrorCode, type FieldIssue } from '@app/shared';

/**
 * An expected, client-safe error. Anything thrown that is *not* an AppError is
 * treated as an internal failure and its details are never sent to clients.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: FieldIssue[];

  constructor(code: ErrorCode, message: string, statusCode = 400, details?: FieldIssue[]) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    if (details) this.details = details;
  }

  static badRequest(message: string, details?: FieldIssue[]): AppError {
    return new AppError(ERROR_CODES.BAD_REQUEST, message, 400, details);
  }

  static validation(details: FieldIssue[], message = 'Some fields are invalid.'): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
  }

  static unauthenticated(message = 'Please sign in to continue.'): AppError {
    return new AppError(ERROR_CODES.UNAUTHENTICATED, message, 401);
  }

  static forbidden(message = 'You do not have permission to do that.'): AppError {
    return new AppError(ERROR_CODES.FORBIDDEN, message, 403);
  }

  static notFound(message = 'The requested resource was not found.'): AppError {
    return new AppError(ERROR_CODES.NOT_FOUND, message, 404);
  }

  static conflict(code: ErrorCode, message: string): AppError {
    return new AppError(code, message, 409);
  }
}
