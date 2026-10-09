import type { CreateBillSplitData } from '@app/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { billSplitService } from '../services/billSplit.service.js';
import { getRequestContext } from '../utils/requestContext.js';
import { sendSuccess } from '../utils/response.js';

const idParam = (req: Request) => (req.params as { id: string }).id;

export async function createBillSplit(req: Request, res: Response): Promise<void> {
  const dto = await billSplitService.create(
    getAuth(req).userId,
    req.body as CreateBillSplitData,
    getRequestContext(req),
  );
  sendSuccess(res, dto, 201);
}

export async function listBillSplits(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await billSplitService.list(getAuth(req).userId));
}

export async function getBillSplit(req: Request, res: Response): Promise<void> {
  sendSuccess(res, await billSplitService.get(getAuth(req).userId, idParam(req)));
}

export async function cancelBillSplit(req: Request, res: Response): Promise<void> {
  sendSuccess(
    res,
    await billSplitService.cancel(getAuth(req).userId, idParam(req), getRequestContext(req)),
  );
}
