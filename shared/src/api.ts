import type { ErrorCode } from './errors.js';

/** A single field-level validation problem. */
export interface FieldIssue {
  path: string;
  message: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  requestId?: string;
  details?: FieldIssue[];
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiFailure {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** `GET /api/health` */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  demoMode: true;
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, 'ok' | 'fail'>;
}

/** `GET /api/config/public` — safe, non-secret runtime configuration. */
export interface PublicConfig {
  appName: string;
  demoMode: true;
  demoBannerText: string;
  disclaimer: string;
  legalNotice: string;
  currency: string;
  currencySymbol: string;
  timezone: string;
  qrScheme: string;
}
