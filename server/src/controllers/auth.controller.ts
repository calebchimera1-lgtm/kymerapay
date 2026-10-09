import type { LoginInput, RegisterBusinessData, RegisterUserData } from '@app/shared';
import type { Request, Response } from 'express';
import { SECURITY } from '../config/security.js';
import { getAuth } from '../middleware/authenticate.js';
import { authService, type AuthResult } from '../services/auth.service.js';
import { verifyPin } from '../services/pin.service.js';
import { AppError } from '../utils/AppError.js';
import { clearRefreshCookie, setRefreshCookie } from '../utils/cookies.js';
import { getRequestContext } from '../utils/requestContext.js';
import { sendSuccess } from '../utils/response.js';

function respondWithSession(res: Response, result: AuthResult, status = 200): void {
  if (result.refreshToken) setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  // Auth responses carry tokens; never let a proxy or the browser cache them.
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, result.auth, status);
}

function readRefreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[SECURITY.refreshCookieName];
  return typeof value === 'string' && value.length > 0 && value.length < 200 ? value : undefined;
}

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterUserData, getRequestContext(req));
  respondWithSession(res, result, 201);
}

export async function registerBusiness(req: Request, res: Response): Promise<void> {
  const result = await authService.registerBusiness(
    req.body as RegisterBusinessData,
    getRequestContext(req),
  );
  respondWithSession(res, result, 201);
}

export async function login(req: Request, res: Response): Promise<void> {
  const { identifier, password } = req.body as LoginInput;
  const result = await authService.login(identifier, password, getRequestContext(req));
  respondWithSession(res, result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const token = readRefreshCookie(req);
    if (!token) throw AppError.unauthenticated('Your session has ended. Please sign in again.');
    respondWithSession(res, await authService.refresh(token, getRequestContext(req)));
  } catch (err) {
    // Whatever went wrong, a dead refresh cookie should not linger in the browser.
    clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  await authService.logout(readRefreshCookie(req), getRequestContext(req));
  clearRefreshCookie(res);
  sendSuccess(res, { signedOut: true });
}

export async function confirmPin(req: Request, res: Response): Promise<void> {
  const { pin } = req.body as { pin: string };
  await verifyPin(getAuth(req).userId, pin, getRequestContext(req));
  sendSuccess(res, { verified: true });
}
