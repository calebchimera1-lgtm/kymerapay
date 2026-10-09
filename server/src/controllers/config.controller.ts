import { BRAND, type PublicConfig } from '@app/shared';
import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { publicLimits } from '../config/limits.js';
import { sendSuccess } from '../utils/response.js';

/** Non-secret configuration the web client needs before sign-in. */
export function getPublicConfig(_req: Request, res: Response): void {
  const config: PublicConfig = {
    appName: env.APP_NAME,
    demoMode: env.DEMO_MODE,
    demoBannerText: BRAND.demo.bannerText,
    disclaimer: BRAND.demo.disclaimer,
    legalNotice: BRAND.demo.legalNotice,
    currency: BRAND.currency.code,
    currencySymbol: BRAND.currency.symbol,
    timezone: BRAND.timezone,
    qrScheme: BRAND.qrScheme,
    limits: publicLimits(),
  };
  res.setHeader('Cache-Control', 'public, max-age=300');
  sendSuccess(res, config);
}
