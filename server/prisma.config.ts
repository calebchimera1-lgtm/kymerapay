import { defineConfig } from 'prisma/config';
import { loadEnvFile } from './src/config/loadEnvFile.js';

// Prisma 7 does not read .env files itself; reuse the server's loader so the
// CLI sees the same configuration as the API (explicit env vars still win).
loadEnvFile();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Optional so `prisma generate` works without a database (e.g. Docker builds).
    url: process.env.DATABASE_URL,
  },
});
