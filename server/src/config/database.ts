import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { logger } from '../utils/logger.js';
import { env } from './env.js';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  // Fail fast instead of hanging requests when the database is unreachable.
  connectionTimeoutMillis: 5_000,
});

/** Application-wide Prisma client (one connection pool per process). */
export const prisma = new PrismaClient({
  adapter,
  log: [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ],
});

prisma.$on('warn', (event) => logger.warn({ target: event.target }, event.message));
prisma.$on('error', (event) => logger.error({ target: event.target }, event.message));

/**
 * Either the root client or the client handed to an interactive transaction.
 * Repositories accept this so they compose inside `prisma.$transaction(...)`.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/** Lightweight readiness probe used by the health endpoint. */
export async function isDatabaseReachable(timeoutMs = 2_000): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Database health check timed out')), timeoutMs);
      }),
    ]);
    return true;
  } catch (err) {
    logger.warn({ err }, 'Database health check failed');
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}

export { Prisma };
