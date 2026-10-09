import type { TransactionLimits } from '@app/shared';
import { money } from '../utils/money.js';
import { env } from './env.js';

/** Payment limits as Decimals for server-side checks. */
export const LIMITS = {
  minAmount: money(env.TXN_MIN_AMOUNT),
  maxAmount: money(env.TXN_MAX_AMOUNT),
  dailySendLimit: money(env.DAILY_SEND_LIMIT),
} as const;

/** The same limits as display strings for the client. */
export function publicLimits(): TransactionLimits {
  return {
    minAmount: LIMITS.minAmount.toFixed(2),
    maxAmount: LIMITS.maxAmount.toFixed(2),
    dailyLimit: LIMITS.dailySendLimit.toFixed(2),
  };
}
