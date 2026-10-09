import type { HealthStatus } from '@app/shared';
import type { Request, Response } from 'express';
import { isDatabaseReachable } from '../config/database.js';
import { sendSuccess } from '../utils/response.js';

/** Liveness/readiness probe. Returns 503 when a dependency is unavailable. */
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const checks: HealthStatus['checks'] = {
    api: 'ok',
    database: (await isDatabaseReachable()) ? 'ok' : 'fail',
  };
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
