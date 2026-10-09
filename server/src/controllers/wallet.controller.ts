import type { PaginationQuery } from '@app/shared';
import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authenticate.js';
import { walletService } from '../services/wallet.service.js';
import { sendSuccess } from '../utils/response.js';

/** Balances are private, per-user data: never cache them in shared caches. */
function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'private, no-store');
}

export async function getWallet(req: Request, res: Response): Promise<void> {
  noStore(res);
  sendSuccess(res, await walletService.getWallet(getAuth(req).userId));
}

export async function getWalletSummary(req: Request, res: Response): Promise<void> {
  noStore(res);
  sendSuccess(res, await walletService.getSummary(getAuth(req).userId));
}

export async function listWalletEntries(req: Request, res: Response): Promise<void> {
  const { cursor, limit } = req.query as unknown as PaginationQuery;
  noStore(res);
  sendSuccess(res, await walletService.listEntries(getAuth(req).userId, limit, cursor));
}
