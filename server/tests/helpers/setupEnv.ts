/**
 * Deterministic environment for the test-suite. Runs before any module that
 * reads `env`, so tests never depend on a developer's local `.env`.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '0';
process.env.LOG_LEVEL = 'silent';
process.env.DEMO_MODE = 'true';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://kespay:kespay_dev_password@localhost:5433/kespay_test?schema=public';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-validation-0123456789';
process.env.JWT_EXPIRES_IN = '15m';
process.env.REFRESH_TOKEN_TTL_DAYS = '7';
