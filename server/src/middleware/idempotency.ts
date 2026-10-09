import { ERROR_CODES, IDEMPOTENCY_KEY_PATTERN } from '@app/shared';
import type { Request, RequestHandler } from 'express';
import {
  idempotencyRepository,
  type IdempotencyReservation,
} from '../repositories/idempotency.repository.js';
import { AppError } from '../utils/AppError.js';
import { sha256 } from '../utils/crypto.js';
import { sendSuccess } from '../utils/response.js';
import { getAuth } from './authenticate.js';

/** Fields that never enter the request fingerprint (a hash of a 4-digit PIN is reversible). */
const SECRET_FIELDS = new Set(['pin', 'password']);

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, entry]) => !SECRET_FIELDS.has(key) && entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

/** Fingerprint of the *validated* request, so "1,500" and "1500.00" are the same request. */
export function fingerprint(scope: string, method: string, path: string, body: unknown): string {
  return sha256(`${scope}|${method}|${path}|${canonicalJson(body)}`);
}

function requestFingerprint(req: Request, scope: string): string {
  return fingerprint(scope, req.method, req.originalUrl.split('?')[0]!, req.body);
}

export interface IdempotentResult<T> {
  statusCode: number;
  body: T;
}

/**
 * Wraps a money-moving handler so that retrying a request with the same
 * `Idempotency-Key` can never move money twice:
 *
 *  • same key + same request, already completed → the original response is
 *    replayed (header `Idempotent-Replayed: true`), nothing is executed;
 *  • same key + a different request → 422 IDEMPOTENCY_KEY_REUSED;
 *  • same key while the first is still running → 409 REQUEST_IN_PROGRESS;
 *  • the handler fails → the key is released, so the client may retry it.
 *
 * The handler must call `idempotencyRepository.complete` inside the same
 * database transaction that moves the money.
 */
export function idempotent<T>(
  scope: string,
  handler: (req: Request, reservation: IdempotencyReservation) => Promise<IdempotentResult<T>>,
): RequestHandler {
  return async (req, res) => {
    const key = req.get('Idempotency-Key');
    if (!key) {
      throw new AppError(
        ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED,
        'An Idempotency-Key header is required for this request.',
        400,
      );
    }
    if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
      throw AppError.badRequest('Idempotency-Key must be 16–100 letters, digits, "-" or "_".');
    }

    const outcome = await idempotencyRepository.reserve(
      getAuth(req).userId,
      key,
      scope,
      requestFingerprint(req, scope),
    );

    res.setHeader('Cache-Control', 'no-store');
    if (outcome.kind === 'replay') {
      res.setHeader('Idempotent-Replayed', 'true');
      sendSuccess(res, outcome.body, outcome.statusCode);
      return;
    }

    let result: IdempotentResult<T>;
    try {
      result = await handler(req, outcome.reservation);
    } catch (err) {
      await idempotencyRepository.release(outcome.reservation);
      throw err;
    }
    sendSuccess(res, result.body, result.statusCode);
  };
}
