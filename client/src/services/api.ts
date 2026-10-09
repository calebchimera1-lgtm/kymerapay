import {
  ERROR_CODES,
  type ApiFailure,
  type ApiSuccess,
  type ErrorCode,
  type FieldIssue,
} from '@app/shared';
import axios, { AxiosError } from 'axios';
import { clientEnv } from '@/config/env';

/**
 * Shared HTTP client. `withCredentials` lets the httpOnly refresh cookie flow;
 * `X-Requested-With` is part of the server's CSRF defence for cookie routes.
 */
export const api = axios.create({
  baseURL: clientEnv.apiUrl,
  timeout: 15_000,
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
});

/** Normalised error thrown by every service call. */
export class ApiClientError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: FieldIssue[];

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    requestId?: string,
    details?: FieldIssue[],
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    if (requestId) this.requestId = requestId;
    if (details) this.details = details;
  }
}

function isApiFailure(value: unknown): value is ApiFailure {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as ApiFailure).success === false &&
    typeof (value as ApiFailure).error?.code === 'string'
  );
}

export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;

  if (error instanceof AxiosError) {
    const body: unknown = error.response?.data;
    if (isApiFailure(body)) {
      const { code, message, requestId, details } = body.error;
      return new ApiClientError(code, message, error.response?.status ?? 0, requestId, details);
    }
    if (!error.response) {
      return new ApiClientError(
        ERROR_CODES.SERVICE_UNAVAILABLE,
        'Cannot reach the server. Check your connection and try again.',
        0,
      );
    }
  }

  return new ApiClientError(
    ERROR_CODES.INTERNAL_ERROR,
    'Something went wrong. Please try again.',
    0,
  );
}

/** Awaits a request and returns the `data` of the success envelope. */
export async function unwrap<T>(request: Promise<{ data: ApiSuccess<T> }>): Promise<T> {
  try {
    const response = await request;
    return response.data.data;
  } catch (error) {
    throw toApiClientError(error);
  }
}
