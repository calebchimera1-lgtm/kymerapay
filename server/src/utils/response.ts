import type { ApiSuccess } from '@app/shared';
import type { Response } from 'express';

/** Sends the standard success envelope: `{ success: true, data, meta? }`. */
export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  meta?: Record<string, unknown>,
): Response {
  const body: ApiSuccess<T> = meta ? { success: true, data, meta } : { success: true, data };
  return res.status(statusCode).json(body);
}
