import { prisma, type DbClient } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { money, toAmountString } from '../utils/money.js';

export interface ReconciliationReport {
  checkedAt: string;
  walletCount: number;
  /** Sum of every balance, treasury included. Must be exactly "0.00". */
  totalBalance: string;
  mismatchedWallets: { walletId: string; balance: string; ledgerBalance: string }[];
  unbalancedTransactions: string[];
  healthy: boolean;
}

/**
 * Independent audit of the ledger. The database already refuses inconsistent
 * commits; this check re-derives everything from the raw entries so that
 * operators (and tests) can prove it, e.g. after a manual intervention.
 */
export async function reconcileLedger(db: DbClient = prisma): Promise<ReconciliationReport> {
  const mismatched = await db.$queryRaw<
    { walletId: string; balance: Prisma.Decimal; ledgerBalance: Prisma.Decimal }[]
  >`
    SELECT w.id AS "walletId", w.balance,
           COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amount ELSE -le.amount END), 0) AS "ledgerBalance"
    FROM wallets w
    LEFT JOIN ledger_entries le ON le.wallet_id = w.id
    GROUP BY w.id
    HAVING w.balance <> COALESCE(SUM(CASE WHEN le.direction = 'CREDIT' THEN le.amount ELSE -le.amount END), 0)`;

  const unbalanced = await db.$queryRaw<{ reference: string }[]>`
    SELECT t.reference
    FROM transactions t
    LEFT JOIN ledger_entries le ON le.transaction_id = t.id
    WHERE t.status IN ('COMPLETED', 'REVERSED')
    GROUP BY t.id
    HAVING COUNT(*) FILTER (WHERE le.direction = 'DEBIT'  AND le.wallet_id = t.from_wallet_id AND le.amount = t.amount) <> 1
        OR COUNT(*) FILTER (WHERE le.direction = 'CREDIT' AND le.wallet_id = t.to_wallet_id   AND le.amount = t.amount) <> 1
        OR COUNT(le.id) <> 2`;

  const [totals] = await db.$queryRaw<{ walletCount: number; total: Prisma.Decimal | null }[]>`
    SELECT COUNT(*)::int AS "walletCount", SUM(balance) AS total FROM wallets`;

  const totalBalance = toAmountString(totals?.total ?? 0);
  return {
    checkedAt: new Date().toISOString(),
    walletCount: totals?.walletCount ?? 0,
    totalBalance,
    mismatchedWallets: mismatched.map((row) => ({
      walletId: row.walletId,
      balance: toAmountString(row.balance),
      ledgerBalance: toAmountString(row.ledgerBalance),
    })),
    unbalancedTransactions: unbalanced.map((row) => row.reference),
    healthy: mismatched.length === 0 && unbalanced.length === 0 && money(totalBalance).isZero(),
  };
}
