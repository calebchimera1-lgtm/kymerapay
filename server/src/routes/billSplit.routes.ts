import { createBillSplitSchema, idParamSchema } from '@app/shared';
import { Router } from 'express';
import * as splits from '../controllers/billSplit.controller.js';
import { requireAuth, requireRole } from '../middleware/authenticate.js';
import { paymentRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const billSplitRouter = Router();

billSplitRouter.use(requireAuth, requireRole('USER'));

billSplitRouter.post(
  '/',
  paymentRateLimiter,
  validate({ body: createBillSplitSchema }),
  splits.createBillSplit,
);
billSplitRouter.get('/', splits.listBillSplits);
billSplitRouter.get('/:id', validate({ params: idParamSchema }), splits.getBillSplit);
billSplitRouter.post('/:id/cancel', validate({ params: idParamSchema }), splits.cancelBillSplit);
