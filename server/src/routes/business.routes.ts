import {
  analyticsQuerySchema,
  idParamSchema,
  pageQuerySchema,
  payBusinessSchema,
  registerBusinessSchema,
  updateBusinessSchema,
  usernameParamSchema,
} from '@app/shared';
import { Router } from 'express';
import { registerBusiness } from '../controllers/auth.controller.js';
import * as business from '../controllers/business.controller.js';
import { requireAuth, requireRole } from '../middleware/authenticate.js';
import {
  paymentRateLimiter,
  registrationRateLimiter,
  searchRateLimiter,
} from '../middleware/rateLimit.js';
import { singleImageUpload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

export const businessRouter = Router();

// Creating a business = registering a business account (same as /api/auth/register/business).
businessRouter.post(
  '/',
  registrationRateLimiter,
  validate({ body: registerBusinessSchema }),
  registerBusiness,
);

const owner = [requireAuth, requireRole('BUSINESS')];
businessRouter.get('/me/dashboard', ...owner, business.getDashboard);
businessRouter.get(
  '/me/analytics',
  ...owner,
  validate({ query: analyticsQuerySchema }),
  business.getAnalytics,
);
businessRouter.get(
  '/me/customers',
  ...owner,
  validate({ query: pageQuerySchema }),
  business.getCustomers,
);
businessRouter.patch(
  '/me',
  ...owner,
  validate({ body: updateBusinessSchema }),
  business.updateBusiness,
);
businessRouter.post('/me/logo', ...owner, singleImageUpload, business.uploadLogo);

businessRouter.post(
  '/:id/pay',
  requireAuth,
  requireRole('USER'),
  paymentRateLimiter,
  validate({ params: idParamSchema, body: payBusinessSchema }),
  business.payBusiness,
);
// Last: `:username` must not shadow the routes above.
businessRouter.get(
  '/:username',
  requireAuth,
  searchRateLimiter,
  validate({ params: usernameParamSchema }),
  business.getBusiness,
);
