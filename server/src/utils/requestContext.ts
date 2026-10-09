import type { Request } from 'express';

/** Who/where a request came from — recorded on sessions and audit logs. */
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
  /** Random per-install ID the web client sends in `X-Device-Id`. Untrusted, used only for "new device" alerts. */
  deviceId: string | null;
}

const SAFE_DEVICE_ID = /^[A-Za-z0-9-]{8,64}$/;

export function getRequestContext(req: Request): RequestContext {
  const deviceId = req.get('X-Device-Id');
  return {
    ip: req.ip ?? null,
    userAgent: req.get('User-Agent')?.slice(0, 255) ?? null,
    requestId: String(req.id),
    deviceId: deviceId && SAFE_DEVICE_ID.test(deviceId) ? deviceId : null,
  };
}
