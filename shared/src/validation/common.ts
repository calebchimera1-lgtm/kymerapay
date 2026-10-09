import { z } from 'zod';

/** `?cursor=<uuid>&limit=20` */
export const paginationQuerySchema = z.object({
  cursor: z.uuid('Invalid cursor.').optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationQuery = z.output<typeof paginationQuerySchema>;
