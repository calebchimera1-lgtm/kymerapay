import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveTestDatabaseUrl } from './testDatabaseUrl.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Applies all migrations to the test database once per test run. */
export default function setup(): void {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: resolveTestDatabaseUrl() },
    stdio: 'pipe',
  });
}
