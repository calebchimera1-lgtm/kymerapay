import { createApp } from './app.js';
import { disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, demoMode: env.DEMO_MODE },
    `${env.APP_NAME} API listening — DEMO MODE, NO REAL MONEY`,
  );
});

const SHUTDOWN_TIMEOUT_MS = 10_000;

function shutdown(signal: NodeJS.Signals): void {
  logger.info({ signal }, 'Shutting down gracefully');
  server.close((err) => {
    disconnectDatabase()
      .catch((dbErr: unknown) => logger.error({ err: dbErr }, 'Error closing database pool'))
      .finally(() => {
        if (err) logger.error({ err }, 'Error during shutdown');
        process.exit(err ? 1 : 0);
      });
  });
  // Force-exit if open connections refuse to drain.
  setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection');
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});
