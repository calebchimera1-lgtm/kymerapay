import {
  createPaymentRequestSchema,
  idParamSchema,
  listPaymentRequestsQuerySchema,
  payRequestSchema,
} from '@app/shared';
import { Router } from 'express';
import * as requests from '../controllers/paymentRequest.controller.js';
import { requireAuth, requireRole } from '../middleware/authenticate.js';
import { paymentRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const paymentRequestRouter = Router();

// People and businesses can request money; only personal accounts pay or decline.
paymentRequestRouter.use(requireAuth, requireRole('USER', 'BUSINESS'));

paymentRequestRouter.post(
  '/',
  paymentRateLimiter,
  validate({ body: createPaymentRequestSchema }),
  requests.createPaymentRequest,
);
paymentRequestRouter.get(
  '/',
  validate({ query: listPaymentRequestsQuerySchema }),
  requests.listPaymentRequests,
);
paymentRequestRouter.get('/summary', requests.getPaymentRequestSummary);
paymentRequestRouter.get('/:id', validate({ params: idParamSchema }), requests.getPaymentRequest);
paymentRequestRouter.post(
  '/:id/pay',
  requireRole('USER'),
  paymentRateLimiter,
  validate({ params: idParamSchema, body: payRequestSchema }),
  requests.payPaymentRequest,
);
paymentRequestRouter.post(
  '/:id/decline',
  requireRole('USER'),
  validate({ params: idParamSchema }),
  requests.declinePaymentRequest,
);
paymentRequestRouter.post(
  '/:id/cancel',
  validate({ params: idParamSchema }),
  requests.cancelPaymentRequest,
);
