import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Loads the first `.env` found in the working directory or its parent (the
 * monorepo root when started through npm workspaces).
 *
 * Variables that are already set (Docker, CI, the shell) always win, so a
 * `.env` file can never override real deployment configuration. Skipped in
 * tests, which configure their own environment.
 */
export function loadEnvFile(): void {
  if (process.env.NODE_ENV === 'test') return;

  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
  ];
  const file = candidates.find((candidate) => existsSync(candidate));
  if (!file) return;

  const parsed = parseEnv(readFileSync(file, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined && value !== undefined) {
      process.env[key] = value;
    }
  }
}
