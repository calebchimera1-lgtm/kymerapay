import { SYSTEM_ACCOUNT } from '../config/constants.js';
import type { DbClient } from '../config/database.js';
import { walletRepository } from '../repositories/wallet.repository.js';

/**
 * Ensures the SYSTEM account and its TREASURY wallet exist. Idempotent: safe to
 * run on every seed and at the start of every test run.
 *
 * The treasury is the counter-party for all simulated money entering or
 * leaving circulation, which keeps the ledger double-entry balanced
 * (the sum of every wallet balance is always zero).
 */
export async function ensureTreasury(db: DbClient) {
  const existing = await walletRepository.findTreasury(db);
  if (existing) return existing;

  const system = await db.user.upsert({
    where: { username: SYSTEM_ACCOUNT.username },
    update: {},
    create: {
      username: SYSTEM_ACCOUNT.username,
      fullName: SYSTEM_ACCOUNT.fullName,
      email: SYSTEM_ACCOUNT.email,
      role: 'SYSTEM',
      isDemo: true,
    },
  });

  return db.wallet.create({
    data: { userId: system.id, type: 'TREASURY', currency: 'KES' },
  });
}
