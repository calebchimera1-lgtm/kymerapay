import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { billSplitRouter } from './billSplit.routes.js';
import { paymentRequestRouter } from './paymentRequest.routes.js';
import { systemRouter } from './system.routes.js';
import { transferRouter } from './transfer.routes.js';
import { userRouter } from './user.routes.js';
import { walletRouter } from './wallet.routes.js';

/** Mounts every feature router under `/api`. */
export const apiRouter = Router();

apiRouter.use(systemRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/users', userRouter);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/transfers', transferRouter);
apiRouter.use('/payment-requests', paymentRequestRouter);
apiRouter.use('/bill-splits', billSplitRouter);
