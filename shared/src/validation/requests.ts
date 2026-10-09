import { z } from 'zod';
import { PAYMENT_REQUEST_STATUSES, SPLIT_METHODS } from '../enums.js';
import { amountSchema } from '../money.js';
import { paginationQuerySchema } from './common.js';
import { noteSchema } from './transfer.js';

const handleSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, '').toLowerCase())
  .pipe(z.string().min(3, 'Choose someone.').max(20, 'Unknown username.'));

const pinSchema = z.string().regex(/^\d{4}$/, 'Enter your 4-digit PIN.');

/** `POST /api/payment-requests` */
export const createPaymentRequestSchema = z.object({
  payer: handleSchema,
  amount: amountSchema,
  note: noteSchema,
  /** Days until the request expires (default 7). */
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});
export type CreatePaymentRequestInput = z.input<typeof createPaymentRequestSchema>;
export type CreatePaymentRequestData = z.output<typeof createPaymentRequestSchema>;

/** `POST /api/payment-requests/:id/pay` */
export const payRequestSchema = z.object({ pin: pinSchema });

export const idParamSchema = z.object({ id: z.uuid('Invalid id.') });

/** `GET /api/payment-requests` */
export const listPaymentRequestsQuerySchema = paginationQuerySchema.extend({
  direction: z.enum(['incoming', 'outgoing']).default('incoming'),
  status: z.enum(PAYMENT_REQUEST_STATUSES).optional(),
});
export type ListPaymentRequestsQuery = z.output<typeof listPaymentRequestsQuerySchema>;

export const MAX_SPLIT_PARTICIPANTS = 19;

/** `POST /api/bill-splits` */
export const createBillSplitSchema = z
  .object({
    title: z.string().trim().min(2, 'Give the bill a name.').max(80, 'Title is too long.'),
    note: noteSchema,
    totalAmount: amountSchema,
    method: z.enum(SPLIT_METHODS).default('EQUAL'),
    /** Whether the creator takes a share (they usually paid the bill). */
    includeSelf: z.boolean().default(true),
    participants: z
      .array(
        z.object({
          username: handleSchema,
          /** Required for CUSTOM splits; ignored for EQUAL. */
          amount: amountSchema.optional(),
        }),
      )
      .min(1, 'Add at least one person.')
      .max(MAX_SPLIT_PARTICIPANTS, `You can split with at most ${MAX_SPLIT_PARTICIPANTS} people.`),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.participants.forEach((participant, index) => {
      if (seen.has(participant.username)) {
        ctx.addIssue({
          code: 'custom',
          path: ['participants', index, 'username'],
          message: 'Each person can only be added once.',
        });
      }
      seen.add(participant.username);
      if (value.method === 'CUSTOM' && !participant.amount) {
        ctx.addIssue({
          code: 'custom',
          path: ['participants', index, 'amount'],
          message: 'Enter this person’s share.',
        });
      }
    });
  });
export type CreateBillSplitInput = z.input<typeof createBillSplitSchema>;
export type CreateBillSplitData = z.output<typeof createBillSplitSchema>;
