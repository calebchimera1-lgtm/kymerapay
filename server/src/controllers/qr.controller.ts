import type { GenerateQrData } from '@app/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { qrService } from '../services/qr.service.js';
import { getRequestContext } from '../utils/requestContext.js';
import { sendSuccess } from '../utils/response.js';

export async function getMyQr(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await qrService.getMine(getAuth(req).userId));
}

export async function generateQr(req: Request, res: Response): Promise<void> {
  const { userId, role } = getAuth(req);
  sendSuccess(
    res,
    await qrService.generate(userId, role, req.body as GenerateQrData, getRequestContext(req)),
    201,
  );
}

export async function listDynamicQr(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await qrService.listActiveDynamic(getAuth(req).userId));
}

export async function revokeQr(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  sendSuccess(res, await qrService.revoke(getAuth(req).userId, id, getRequestContext(req)));
}

export async function resolveQr(req: Request, res: Response): Promise<void> {
  const { code } = req.params as { code: string };
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, await qrService.resolve(getAuth(req).userId, code));
}
