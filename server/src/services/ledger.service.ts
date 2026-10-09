import { ERROR_CODES } from '@app/shared';
import type { Prisma, TransactionType, Visibility } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';
import { hasCentsPrecision, money, ZERO, type Money } from '../utils/money.js';
import { generateTransactionReference } from '../utils/reference.js';

/**
 * The ledger service is the ONLY code that changes wallet balances.
 *
 * Every money movement — transfers, request payments, bill splits, business
 * payments, demo funding, admin adjustments — goes through `postTransfer`,
 * which writes one immutable transaction, one DEBIT and one CREDIT ledger
 * line, and both new balances, inside the caller's database transaction.
 * PostgreSQL triggers re-verify the result at COMMIT (see docs/database.md).
 */

export interface PostTransferInput {
  type: TransactionType;
  fromWalletId: string;
  toWalletId: string;
  amount: Money;
  initiatorId: string;
  note?: string | null;
  visibility?: Visibility;
  paymentRequestId?: string;
  billSplitId?: string;
  qrCodeId?: string;
  provider?: string;
  providerRef?: string;
  metadata?: Prisma.InputJsonObject;
}

interface LockedWallet {
  id: string;
  type: 'PERSONAL' | 'BUSINESS' | 'TREASURY';
  status: 'ACTIVE' | 'FROZEN';
  currency: string;
  balance: Prisma.Decimal | string;
  userStatus: 'ACTIVE' | 'SUSPENDED';
}

export interface PostedTransfer {
  id: string;
  reference: string;
  type: TransactionType;
  amount: Money;
  fromBalanceAfter: Money;
  toBalanceAfter: Money;
  createdAt: Date;
}

/**
 * Locks both wallets with SELECT … FOR UPDATE. Ordering by id means two
 * opposite transfers (A→B and B→A) always lock in the same order, so they
 * queue instead of deadlocking.
 */
async function lockWallets(tx: Prisma.TransactionClient, a: string, b: string) {
  const rows = await tx.$queryRaw<LockedWallet[]>`
    SELECT w.id, w.type::text AS type, w.status::text AS status, w.currency, w.balance,
           u.status::text AS "userStatus"
    FROM wallets w
    JOIN users u ON u.id = w.user_id
    WHERE w.id IN (${a}::uuid, ${b}::uuid)
    ORDER BY w.id
    FOR UPDATE OF w`;
  return new Map(rows.map((row) => [row.id, row]));
}

async function uniqueReference(tx: Prisma.TransactionClient): Promise<string> {
  // 32^10 possibilities; a collision is astronomically unlikely but checked anyway,
  // because a failed INSERT would abort the whole database transaction.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = generateTransactionReference();
    const clash = await tx.transaction.findUnique({ where: { reference }, select: { id: true } });
    if (!clash) return reference;
  }
  throw new Error('Could not allocate a unique transaction reference');
}

export async function postTransfer(
  tx: Prisma.TransactionClient,
  input: PostTransferInput,
): Promise<PostedTransfer> {
  const amount = money(input.amount);
  if (!amount.isFinite() || amount.lte(ZERO) || !hasCentsPrecision(amount)) {
    throw new AppError(
      ERROR_CODES.AMOUNT_OUT_OF_RANGE,
      'Amount must be positive with at most 2 decimals.',
      422,
    );
  }
  if (input.fromWalletId === input.toWalletId) {
    throw new AppError(ERROR_CODES.SELF_TRANSFER, 'You cannot send money to yourself.', 422);
  }

  const wallets = await lockWallets(tx, input.fromWalletId, input.toWalletId);
  const from = wallets.get(input.fromWalletId);
  const to = wallets.get(input.toWalletId);
  if (!from || !to) throw AppError.notFound('Wallet not found.');

  if (from.userStatus !== 'ACTIVE') {
    throw new AppError(ERROR_CODES.ACCOUNT_SUSPENDED, 'This account has been suspended.', 403);
  }
  if (from.status !== 'ACTIVE') {
    throw new AppError(ERROR_CODES.WALLET_FROZEN, 'Your wallet is frozen. Contact support.', 403);
  }
  if (to.userStatus !== 'ACTIVE' || to.status !== 'ACTIVE') {
    throw new AppError(
      ERROR_CODES.RECIPIENT_UNAVAILABLE,
      'This recipient cannot receive payments right now.',
      422,
    );
  }
  if (from.currency !== 'KES' || to.currency !== 'KES') {
    throw AppError.badRequest('Only KES wallets are supported.');
  }

  const fromBalanceAfter = money(from.balance).minus(amount);
  const toBalanceAfter = money(to.balance).plus(amount);
  // The treasury issues simulated money and is the only wallet allowed below zero.
  if (from.type !== 'TREASURY' && fromBalanceAfter.lt(ZERO)) {
    throw new AppError(ERROR_CODES.INSUFFICIENT_BALANCE, 'Insufficient wallet balance.', 422);
  }

  const now = new Date();
  const transaction = await tx.transaction.create({
    data: {
      reference: await uniqueReference(tx),
      type: input.type,
      status: 'COMPLETED',
      amount,
      currency: 'KES',
      fromWalletId: input.fromWalletId,
      toWalletId: input.toWalletId,
      initiatorId: input.initiatorId,
      note: input.note ?? null,
      visibility: input.visibility ?? 'PRIVATE',
      paymentRequestId: input.paymentRequestId ?? null,
      billSplitId: input.billSplitId ?? null,
      qrCodeId: input.qrCodeId ?? null,
      provider: input.provider ?? 'demo',
      providerRef: input.providerRef ?? null,
      ...(input.metadata ? { metadata: input.metadata } : {}),
      completedAt: now,
      ledgerEntries: {
        create: [
          {
            walletId: input.fromWalletId,
            direction: 'DEBIT',
            amount,
            balanceAfter: fromBalanceAfter,
          },
          { walletId: input.toWalletId, direction: 'CREDIT', amount, balanceAfter: toBalanceAfter },
        ],
      },
    },
    select: { id: true, reference: true, type: true, createdAt: true },
  });

  // Absolute values are safe: both rows are locked until COMMIT.
  await tx.wallet.update({
    where: { id: input.fromWalletId },
    data: { balance: fromBalanceAfter },
  });
  await tx.wallet.update({ where: { id: input.toWalletId }, data: { balance: toBalanceAfter } });

  return { ...transaction, amount, fromBalanceAfter, toBalanceAfter };
}
