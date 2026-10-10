import { z } from 'zod';
import { VISIBILITIES, type BusinessCategory } from './enums.js';
import { amountSchema } from './money.js';
import type { PublicProfile, TransferResult } from './transfer.js';
import { businessDetailsSchema, fullNameSchema } from './validation/auth.js';
import { noteSchema } from './validation/transfer.js';

/** `GET /api/businesses/:username` — public business card (no contact details). */
export interface BusinessPublicProfile extends PublicProfile {
  kind: 'business';
  businessName: string;
  category: BusinessCategory;
  location: string;
  description: string | null;
}

/** `POST /api/businesses/:id/pay` */
export const payBusinessSchema = z.object({
  amount: amountSchema,
  note: noteSchema,
  qrCode: z
    .string()
    .regex(/^[A-Za-z0-9_-]{16,32}$/, 'Invalid QR code.')
    .optional(),
  pin: z.string().regex(/^\d{4}$/, 'Enter your 4-digit PIN.'),
});
export type PayBusinessInput = z.input<typeof payBusinessSchema>;
export type PayBusinessResult = TransferResult;

/** Optional text that can be cleared: "" → null (remove), undefined → leave unchanged. */
const clearableText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .nullable()
    .optional()
    .transform((value) => (value === '' ? null : value));

/** `PATCH /api/businesses/me` — any subset of the business details. */
export const updateBusinessSchema = z
  .object({
    businessName: businessDetailsSchema.shape.businessName.optional(),
    category: businessDetailsSchema.shape.category.optional(),
    location: businessDetailsSchema.shape.location.optional(),
    description: clearableText(500, 'Description must be at most 500 characters.'),
    registrationNumber: clearableText(40, 'Registration number is too long.').refine(
      (value) => value === null || value === undefined || /^[A-Za-z0-9/-]+$/.test(value),
      'Use letters, numbers, "/" or "-" only.',
    ),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    'Change at least one field.',
  );
export type UpdateBusinessInput = z.input<typeof updateBusinessSchema>;

/** `PATCH /api/users/me` */
export const updateProfileSchema = z
  .object({
    fullName: fullNameSchema.optional(),
    defaultVisibility: z.enum(VISIBILITIES).optional(),
  })
  .refine(
    (value) => value.fullName !== undefined || value.defaultVisibility !== undefined,
    'Change at least one field.',
  );
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

export const analyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .pipe(z.union([z.literal(7), z.literal(30), z.literal(90)]))
    .default(30),
});

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export interface BusinessDashboard {
  /** Calendar day in Africa/Nairobi. */
  today: { sales: string; transactions: number; customers: number };
  totalCustomers: number;
  pendingRequests: { count: number; amount: string };
  balance: string;
}

export interface SalesDay {
  date: string;
  sales: string;
  transactions: number;
}

export interface TopCustomer {
  customer: PublicProfile;
  total: string;
  payments: number;
}

export interface BusinessAnalytics {
  periodDays: number;
  totalSales: string;
  /** Sales in the period before this one, for comparison. */
  previousPeriodSales: string;
  transactions: number;
  averageSale: string;
  uniqueCustomers: number;
  daily: SalesDay[];
  topCustomers: TopCustomer[];
}

export interface CustomerSummary {
  customer: PublicProfile;
  totalSpent: string;
  payments: number;
  lastPaidAt: string;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  totalItems: number;
  totalPages: number;
}
