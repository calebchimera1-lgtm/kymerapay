import { idempotencyRepository } from '../repositories/idempotency.repository.js';
import { logger } from '../utils/logger.js';

interface Job {
  name: string;
  everyMs: number;
  run: () => Promise<unknown>;
}

/**
 * Minimal in-process scheduler for housekeeping. Jobs are idempotent and safe
 * to run on several instances at once; move them to a real queue/cron when
 * the API runs at scale.
 */
const JOBS: Job[] = [
  {
    name: 'purge-expired-idempotency-keys',
    everyMs: 60 * 60 * 1000,
    run: async () => {
      const { count } = await idempotencyRepository.purgeExpired();
      if (count > 0) logger.info({ count }, 'Purged expired idempotency keys');
    },
  },
];

export function startScheduler(): () => void {
  const timers = JOBS.map((job) => {
    const execute = () =>
      job
        .run()
        .catch((err: unknown) => logger.error({ err, job: job.name }, 'Scheduled job failed'));
    return setInterval(execute, job.everyMs).unref();
  });
  return () => timers.forEach(clearInterval);
}
