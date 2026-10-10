import type { PayBusinessInput, PayBusinessResult, UpdateBusinessInput } from '@app/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { idempotent } from '../middleware/idempotency.js';
import { businessService } from '../services/business.service.js';
import { sendMoney } from '../services/transfer.service.js';
import { getRequestContext } from '../utils/requestContext.js';
import { sendSuccess } from '../utils/response.js';

export async function getBusiness(req: Request, res: Response): Promise<void> {
  const { username } = req.params as { username: string };
  sendSuccess(res, await businessService.getPublicByUsername(username));
}

/** `POST /api/businesses/:id/pay` — the same confirm-first, idempotent money path as transfers. */
export const payBusiness = idempotent<PayBusinessResult>(
  'businesses.pay',
  async (req, reservation) => {
    const { id } = req.params as { id: string };
    const business = await businessService.getPublicById(id);
    const input = req.body as PayBusinessInput & { amount: string };
    return {
      statusCode: 201,
      body: await sendMoney(
        getAuth(req).userId,
        {
          recipient: business.username,
          amount: input.amount,
          pin: input.pin,
          note: input.note || undefined,
          ...(input.qrCode ? { qrCode: input.qrCode } : {}),
        },
        getRequestContext(req),
        reservation,
      ),
    };
  },
);

export async function getDashboard(req: Request, res: Response): Promise<void> {
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await businessService.dashboard(getAuth(req).userId));
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const { days } = req.query as unknown as { days: number };
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await businessService.analytics(getAuth(req).userId, days));
}

export async function getCustomers(req: Request, res: Response): Promise<void> {
  const { page, limit } = req.query as unknown as { page: number; limit: number };
  sendSuccess(res, await businessService.customers(getAuth(req).userId, page, limit));
}

export async function updateBusiness(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await businessService.updateProfile(
      getAuth(req).userId,
      req.body as UpdateBusinessInput,
      getRequestContext(req),
    ),
  );
}

export async function uploadLogo(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await businessService.setLogo(getAuth(req).userId, req.file!.buffer, getRequestContext(req)),
  );
}
