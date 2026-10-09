import { userSearchQuerySchema, usernameParamSchema } from '@app/shared';
import { Router } from 'express';
import * as users from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/authenticate.js';
import { searchRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';

export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get('/me', users.getMe);
userRouter.get(
  '/search',
  searchRateLimiter,
  validate({ query: userSearchQuerySchema }),
  users.searchUsers,
);
// Must stay last: `:username` would otherwise swallow /me and /search.
userRouter.get(
  '/:username',
  searchRateLimiter,
  validate({ params: usernameParamSchema }),
  users.getPublicProfile,
);
