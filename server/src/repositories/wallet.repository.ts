import type { DbClient } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { counterpartyUserSelect } from './selects.js';

const counterpartyUser = { select: counterpartyUserSelect } as const;

const entryInclude = {
  transaction: {
    select: {
      id: true,
      reference: true,
      type: true,
      note: true,
      fromWallet: { select: { user: counterpartyUser } },
      toWallet: { select: { user: counterpartyUser } },
    },
  },
} satisfies Prisma.LedgerEntryInclude;

export type EntryWithTransaction = Prisma.LedgerEntryGetPayload<{ include: typeof entryInclude }>;

/** Data access for wallets. Balances are only ever changed by the ledger service. */
export const walletRepository = {
  findByUserId(db: DbClient, userId: string) {
    return db.wallet.findUnique({ where: { userId } });
  },

  findTreasury(db: DbClient) {
    return db.wallet.findFirst({ where: { type: 'TREASURY' } });
  },

  /** Newest-first statement page. `cursor` is the id of the last entry already shown. */
  listEntries(db: DbClient, walletId: string, take: number, cursor?: string) {
    return db.ledgerEntry.findMany({
      where: { walletId },
      include: entryInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  /** Daily money in/out for the last `days` calendar days in the given timezone. */
  dailyFlows(db: DbClient, walletId: string, days: number, timezone: string) {
    return db.$queryRaw<
      { day: string; moneyIn: Prisma.Decimal; moneyOut: Prisma.Decimal; count: number }[]
    >`
      SELECT to_char((le.created_at AT TIME ZONE ${timezone})::date, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(le.amount) FILTER (WHERE le.direction = 'CREDIT'), 0) AS "moneyIn",
             COALESCE(SUM(le.amount) FILTER (WHERE le.direction = 'DEBIT'), 0)  AS "moneyOut",
             COUNT(*)::int AS count
      FROM ledger_entries le
      WHERE le.wallet_id = ${walletId}::uuid
        AND le.created_at >= (
          (date_trunc('day', now() AT TIME ZONE ${timezone}) - make_interval(days => ${days - 1}))
          AT TIME ZONE ${timezone}
        )
      GROUP BY day
      ORDER BY day`;
  },
};
