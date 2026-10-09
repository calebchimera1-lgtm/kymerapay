import { Router } from 'express';
import { systemRouter } from './system.routes.js';

/** Mounts every feature router under `/api`. */
export const apiRouter = Router();

apiRouter.use(systemRouter);
