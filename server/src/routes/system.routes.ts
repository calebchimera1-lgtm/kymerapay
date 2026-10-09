import { Router } from 'express';
import { getPublicConfig } from '../controllers/config.controller.js';
import { getHealth } from '../controllers/health.controller.js';

export const systemRouter = Router();

systemRouter.get('/health', getHealth);
systemRouter.get('/config/public', getPublicConfig);
