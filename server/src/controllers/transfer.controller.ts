import type { CreateTransferData, TransferResult } from '@app/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { idempotent } from '../middleware/idempotency.js';
import { recentRecipients, sendMoney } from '../services/transfer.service.js';
import { getRequestContext } from '../utils/requestContext.js';
import { sendSuccess } from '../utils/response.js';

/** `POST /api/transfers` — requires `Idempotency-Key`. */
export const createTransfer = idempotent<TransferResult>(
  'transfers.create',
  async (req, reservation) => ({
    statusCode: 201,
    body: await sendMoney(
      getAuth(req).userId,
      req.body as CreateTransferData,
      getRequestContext(req),
      reservation,
    ),
  }),
);

export async function listRecentRecipients(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await recentRecipients(getAuth(req).userId));
}
