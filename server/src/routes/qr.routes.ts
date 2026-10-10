import { generateQrSchema, idParamSchema, qrCodeParamSchema } from '@app/shared';
import { Router } from 'express';
import * as qr from '../controllers/qr.controller.js';
import { requireAuth, requireRole } from '../middleware/authenticate.js';
import { searchRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const qrRouter = Router();

qrRouter.use(requireAuth, requireRole('USER', 'BUSINESS'));

qrRouter.get('/me', qr.getMyQr);
qrRouter.post('/generate', searchRateLimiter, validate({ body: generateQrSchema }), qr.generateQr);
qrRouter.get('/dynamic', requireRole('BUSINESS'), qr.listDynamicQr);
qrRouter.post(
  '/:id/revoke',
  requireRole('BUSINESS'),
  validate({ params: idParamSchema }),
  qr.revokeQr,
);
// Rate-limited: codes are unguessable (144 bits), but lookups should not be farmable.
qrRouter.get(
  '/resolve/:code',
  searchRateLimiter,
  validate({ params: qrCodeParamSchema }),
  qr.resolveQr,
);
