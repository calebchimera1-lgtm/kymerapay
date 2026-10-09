import { BRAND } from '@app/shared';
import { z } from 'zod';
import { loadEnvFile } from './loadEnvFile.js';

loadEnvFile();

const PLACEHOLDER_SECRET = 'replace-me-with-a-long-random-secret-of-at-least-32-chars';

/** Parses "true"/"false"/"1"/"0" — `z.coerce.boolean()` would treat "false" as true. */
const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const durationString = z.string().regex(/^\d+[smhd]$/, 'Use a duration such as 15m, 1h or 7d');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(0).max(65535).default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),

    APP_NAME: z.string().trim().min(1).max(40).default(BRAND.name),

    // V1 is a sandbox. Anything other than an explicit "true" stops the boot.
    DEMO_MODE: z.literal('true', {
      error: 'DEMO_MODE must be "true" — this build only supports simulated money.',
    }),

    CLIENT_URL: z
      .string()
      .min(1)
      .transform((value) =>
        value
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean),
      )
      .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),

    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must be a PostgreSQL connection string'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: durationString.default('15m'),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    COOKIE_SECURE: booleanString.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === 'production' && value.JWT_SECRET === PLACEHOLDER_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET still has the .env.example placeholder value',
      });
    }
  })
  .transform((value) => ({
    ...value,
    DEMO_MODE: true as const,
    // Secure cookies are mandatory in production regardless of configuration.
    COOKIE_SECURE: value.NODE_ENV === 'production' ? true : (value.COOKIE_SECURE ?? false),
    isProduction: value.NODE_ENV === 'production',
    isTest: value.NODE_ENV === 'test',
  }));

export type Env = z.infer<typeof envSchema>;

function parseEnvironment(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    // Report variable names and rules only — never echo values, which may be secrets.
    const problems = result.error.issues
      .map((issue) => `  • ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    process.stderr.write(`\n✖ Invalid environment configuration:\n${problems}\n\n`);
    process.exit(1);
  }
  return result.data;
}

export const env: Env = Object.freeze(parseEnvironment());
