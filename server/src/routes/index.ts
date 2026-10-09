import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { systemRouter } from './system.routes.js';
import { userRouter } from './user.routes.js';

/** Mounts every feature router under `/api`. */
export const apiRouter = Router();

apiRouter.use(systemRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
