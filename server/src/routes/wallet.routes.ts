import { paginationQuerySchema } from '@app/shared';
import { Router } from 'express';
import * as wallet from '../controllers/wallet.controller.js';
import { requireAuth, requireRole } from '../middleware/authenticate.js';
import { validate } from '../middleware/validate.js';

export const walletRouter = Router();

// Only money-holding accounts have wallets; admins never do.
walletRouter.use(requireAuth, requireRole('USER', 'BUSINESS'));

walletRouter.get('/', wallet.getWallet);
walletRouter.get('/summary', wallet.getWalletSummary);
walletRouter.get('/entries', validate({ query: paginationQuerySchema }), wallet.listWalletEntries);
