import { createTransferSchema } from '@app/shared';
import { Router } from 'express';
import * as transfers from '../controllers/transfer.controller.js';
import { requireAuth, requireRole } from '../middleware/authenticate.js';
import { paymentRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const transferRouter = Router();

// Personal accounts send money; businesses receive it (V1 role matrix).
transferRouter.use(requireAuth, requireRole('USER'));

transferRouter.post(
  '/',
  paymentRateLimiter,
  validate({ body: createTransferSchema }),
  transfers.createTransfer,
);
transferRouter.get('/recent-recipients', transfers.listRecentRecipients);
