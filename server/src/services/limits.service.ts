import { BRAND, ERROR_CODES, formatMoney } from '@app/shared';
import { LIMITS } from '../config/limits.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString, type Money } from '../utils/money.js';

/** Payments a user initiates; funding and admin adjustments don't count towards limits. */
const USER_INITIATED_TYPES = ['TRANSFER', 'REQUEST_PAYMENT', 'SPLIT_PAYMENT', 'BUSINESS_PAYMENT'];

/** Per-payment bounds, checked before any database work. */
export function assertAmountWithinLimits(amount: Money): void {
  if (amount.lt(LIMITS.minAmount) || amount.gt(LIMITS.maxAmount)) {
    throw new AppError(
      ERROR_CODES.AMOUNT_OUT_OF_RANGE,
      `Amounts must be between ${formatMoney(toAmountString(LIMITS.minAmount))} and ${formatMoney(toAmountString(LIMITS.maxAmount))}.`,
      422,
    );
  }
}

/**
 * Daily outgoing limit for the current calendar day in Nairobi. Must run while
 * the sender's wallet is locked (via the ledger's `afterLock` hook) so that
 * concurrent payments cannot each pass the check and together exceed it.
 */
export async function assertWithinDailyLimit(
  tx: Prisma.TransactionClient,
  walletId: string,
  amount: Money,
): Promise<void> {
  const [row] = await tx.$queryRaw<{ total: Prisma.Decimal | null }[]>`
    SELECT SUM(le.amount) AS total
    FROM ledger_entries le
    JOIN transactions t ON t.id = le.transaction_id
    WHERE le.wallet_id = ${walletId}::uuid
      AND le.direction = 'DEBIT'
      AND t.type::text = ANY(${USER_INITIATED_TYPES})
      AND le.created_at >= (date_trunc('day', now() AT TIME ZONE ${BRAND.timezone}) AT TIME ZONE ${BRAND.timezone})`;

  const sentToday = money(row?.total ?? 0);
  if (sentToday.plus(amount).gt(LIMITS.dailySendLimit)) {
    const remaining = LIMITS.dailySendLimit.minus(sentToday);
    throw new AppError(
      ERROR_CODES.DAILY_LIMIT_EXCEEDED,
      `This would exceed your daily limit of ${formatMoney(toAmountString(LIMITS.dailySendLimit))}. ` +
        `You can send up to ${formatMoney(toAmountString(remaining.lt(0) ? 0 : remaining))} more today.`,
      422,
    );
  }
}
