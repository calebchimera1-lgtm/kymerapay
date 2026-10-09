import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const DEFAULT_TEST_DATABASE_URL =
  'postgresql://kespay:kespay_dev_password@localhost:5433/kespay_test?schema=public';

/**
 * Resolves the test database URL from TEST_DATABASE_URL (shell or root .env),
 * falling back to the docker-compose `postgres-test` service.
 *
 * Refuses any database whose name does not contain "test": the suite truncates
 * every table, so pointing it at a real database must be impossible.
 */
export function resolveTestDatabaseUrl(): string {
  let url = process.env.TEST_DATABASE_URL;

  if (!url) {
    const rootEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../.env');
    if (existsSync(rootEnv)) url = parseEnv(readFileSync(rootEnv, 'utf8')).TEST_DATABASE_URL;
  }
  url ??= DEFAULT_TEST_DATABASE_URL;

  const databaseName = new URL(url).pathname.replace(/^\//, '');
  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}": its name must contain "test".`,
    );
  }
  return url;
}
