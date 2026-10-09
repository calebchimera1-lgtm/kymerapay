import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { logger } from './logger.js';

const MAX_ATTEMPTS = 3;

/**
 * Serialization failures (40001) and deadlocks (40P01) are expected under
 * contention and are safe to retry: PostgreSQL rolled the whole transaction back.
 */
export function isRetryableTransactionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') return true;
  const text =
    err instanceof Error
      ? `${err.message} ${JSON.stringify((err as { meta?: unknown }).meta ?? '')}`
      : '';
  return /40P01|40001|deadlock detected|could not serialize access/i.test(text);
}

/**
 * Runs `work` in one interactive database transaction (all-or-nothing) and
 * transparently retries it if PostgreSQL aborts it because of a conflict.
 * `work` must therefore be free of side effects outside the database.
 */
export async function runInTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(work, { maxWait: 5_000, timeout: 15_000 });
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS || !isRetryableTransactionError(err)) throw err;
      logger.warn({ attempt }, 'Retrying database transaction after a write conflict');
      await new Promise((resolve) => setTimeout(resolve, 20 * attempt + Math.random() * 30));
    }
  }
}
