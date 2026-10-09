import type { Response } from 'express';
import { env } from '../config/env.js';
import { SECURITY } from '../config/security.js';

const baseOptions = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: SECURITY.refreshCookiePath,
});

/** The refresh token lives only in this httpOnly cookie — never in JS-readable storage. */
export function setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
  res.cookie(SECURITY.refreshCookieName, token, { ...baseOptions(), expires: expiresAt });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(SECURITY.refreshCookieName, baseOptions());
}
