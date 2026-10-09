/**
 * Database seed — DEMO DATA ONLY, NO REAL MONEY.
 *
 * Phase 2 scaffold: creates the SYSTEM account and treasury wallet. Demo users,
 * the demo business and their simulated balances are added once registration
 * (Phase 3) and the ledger (Phase 4) exist, so balances are created through
 * proper FUNDING transactions rather than written directly.
 *
 * Idempotent — running it repeatedly is safe.
 */
import { disconnectDatabase, prisma } from '../src/config/database.js';
import { ensureTreasury } from '../src/services/bootstrap.service.js';
import { logger } from '../src/utils/logger.js';

async function main(): Promise<void> {
  const treasury = await ensureTreasury(prisma);
  logger.info({ walletId: treasury.id }, 'Treasury wallet ready');
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
