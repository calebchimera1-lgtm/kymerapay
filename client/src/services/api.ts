import {
  ERROR_CODES,
  type ApiFailure,
  type ApiSuccess,
  type AuthSession,
  type ErrorCode,
  type FieldIssue,
} from '@app/shared';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { clientEnv } from '@/config/env';
import { useAuthStore } from '@/store/authStore';
import { getDeviceId } from '@/utils/device';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Don't try to refresh the session when this request returns 401. */
    skipAuthRefresh?: boolean;
    /** Set internally after one refresh-and-retry, to prevent loops. */
    retriedAfterRefresh?: boolean;
  }
}

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

// ── Session refresh ──────────────────────────────────────────────────────────

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers
 * share one request (single-flight). Resolves to null — and clears the
 * session — when the user must sign in again.
 */
export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= api
    .post<ApiSuccess<AuthSession>>('/auth/refresh', undefined, { skipAuthRefresh: true })
    .then((response) => {
      useAuthStore.getState().setSession(response.data.data);
      return response.data.data.accessToken;
    })
    .catch(() => {
      useAuthStore.getState().clear();
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  config.headers.set('X-Device-Id', getDeviceId());
  return config;
});

const SESSION_ERRORS: ReadonlySet<string> = new Set([
  ERROR_CODES.TOKEN_EXPIRED,
  ERROR_CODES.UNAUTHENTICATED,
]);

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || !error.config) throw error;
  const { config, response } = error;
  const code = (response?.data as ApiFailure | undefined)?.error?.code;

  const shouldRefresh =
    response?.status === 401 &&
    code !== undefined &&
    SESSION_ERRORS.has(code) &&
    !config.skipAuthRefresh &&
    !config.retriedAfterRefresh;
  if (!shouldRefresh) throw error;

  const token = await refreshSession();
  if (!token) throw error;

  config.retriedAfterRefresh = true;
  config.headers.set('Authorization', `Bearer ${token}`);
  return api.request(config);
});
