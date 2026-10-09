import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { authService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';

export async function getMe(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await authService.getMe(getAuth(req).userId));
}
