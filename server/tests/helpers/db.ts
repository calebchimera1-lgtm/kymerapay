import { prisma } from '../../src/config/database.js';
import { ensureTreasury } from '../../src/services/bootstrap.service.js';

/**
 * Empties every application table. TRUNCATE (unlike DELETE) does not fire the
 * append-only row triggers — acceptable here because the test database is
 * disposable; production roles should not be granted TRUNCATE.
 */
export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await ensureTreasury(prisma);
}

export { prisma };
