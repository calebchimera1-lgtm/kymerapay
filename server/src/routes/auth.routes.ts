import {
  loginSchema,
  registerBusinessSchema,
  registerUserSchema,
  verifyPinSchema,
} from '@app/shared';
import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/authenticate.js';
import { requireCsrfHeader } from '../middleware/csrf.js';
import {
  loginRateLimiter,
  refreshRateLimiter,
  registrationRateLimiter,
} from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const authRouter = Router();

authRouter.post(
  '/register',
  registrationRateLimiter,
  validate({ body: registerUserSchema }),
  auth.register,
);
authRouter.post(
  '/register/business',
  registrationRateLimiter,
  validate({ body: registerBusinessSchema }),
  auth.registerBusiness,
);
authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), auth.login);

// Cookie-authenticated endpoints: CSRF header required.
authRouter.post('/refresh', refreshRateLimiter, requireCsrfHeader, auth.refresh);
authRouter.post('/logout', requireCsrfHeader, auth.logout);

authRouter.post('/pin/verify', requireAuth, validate({ body: verifyPinSchema }), auth.confirmPin);
