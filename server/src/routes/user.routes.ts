import { Router } from 'express';
import { getMe } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/authenticate.js';

export const userRouter = Router();

userRouter.get('/me', requireAuth, getMe);
