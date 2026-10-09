/**
 * `npm run ledger:check` — verifies that every wallet balance equals its
 * ledger, every completed transaction is balanced and all balances sum to zero.
 * Exits non-zero when anything is off, so it can run in CI or a cron job.
 */
import { disconnectDatabase } from '../src/config/database.js';
import { reconcileLedger } from '../src/services/reconciliation.service.js';
import { logger } from '../src/utils/logger.js';

const report = await reconcileLedger();
if (report.healthy) {
  logger.info(report, 'Ledger reconciled — all balances match');
} else {
  logger.error(report, 'LEDGER RECONCILIATION FAILED');
  process.exitCode = 1;
}
await disconnectDatabase();
