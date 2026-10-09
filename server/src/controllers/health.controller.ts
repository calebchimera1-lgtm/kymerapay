import type { HealthStatus } from '@app/shared';
import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/response.js';

/** Liveness/readiness probe. Dependency checks (database) are added in Phase 2. */
export function getHealth(_req: Request, res: Response): void {
  const checks: HealthStatus['checks'] = { api: 'ok' };
  const healthy = Object.values(checks).every((check) => check === 'ok');

  const body: HealthStatus = {
    status: healthy ? 'ok' : 'degraded',
    demoMode: true,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks,
  };
  sendSuccess(res, body, healthy ? 200 : 503);
}
