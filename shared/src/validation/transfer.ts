import { z } from 'zod';
import { VISIBILITIES } from '../enums.js';
import { amountSchema } from '../money.js';
import { usernameSchema } from './auth.js';

export const noteSchema = z
  .string()
  .trim()
  .max(140, 'Notes can be at most 140 characters.')
  .optional()
  .transform((value) => (value ? value : undefined));

/** `POST /api/transfers` */
export const createTransferSchema = z.object({
  /** "@john254" or "john254". Reserved names are fine here — they simply won't exist. */
  recipient: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, '').toLowerCase())
    .pipe(z.string().min(3, 'Choose who to pay.').max(20, 'Unknown recipient.')),
  amount: amountSchema,
  note: noteSchema,
  visibility: z.enum(VISIBILITIES).optional(),
  /** Set when paying by scanning a QR code; the server checks it matches the recipient. */
  qrCode: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,32}$/, 'Invalid QR code.')
    .optional(),
  pin: z.string().regex(/^\d{4}$/, 'Enter your 4-digit PIN.'),
});
export type CreateTransferInput = z.input<typeof createTransferSchema>;
export type CreateTransferData = z.output<typeof createTransferSchema>;

/** `GET /api/users/search?q=` */
export const userSearchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ''))
    .pipe(z.string().min(2, 'Type at least 2 characters.').max(50)),
});

/** `GET /api/users/:username` */
export const usernameParamSchema = z.object({ username: usernameSchema });

/** Client-generated key that makes a money-moving request safe to retry. */
export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;
