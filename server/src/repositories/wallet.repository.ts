import type { DbClient } from '../config/database.js';

/** Data access for wallets. Balance mutation lives in the ledger service (Phase 4). */
export const walletRepository = {
  findByUserId(db: DbClient, userId: string) {
    return db.wallet.findUnique({ where: { userId } });
  },

  findTreasury(db: DbClient) {
    return db.wallet.findFirst({ where: { type: 'TREASURY' } });
  },
};
