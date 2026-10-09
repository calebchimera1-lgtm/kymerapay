/**
 * Enum values shared by client and server. They mirror the Prisma enums;
 * the server test-suite asserts they stay in sync.
 */
export const ROLES = ['USER', 'BUSINESS', 'ADMIN', 'SYSTEM'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const VISIBILITIES = ['PRIVATE', 'FRIENDS'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const BUSINESS_CATEGORIES = [
  'RETAIL',
  'FOOD_AND_DRINK',
  'SERVICES',
  'TRANSPORT',
  'HEALTH',
  'EDUCATION',
  'ENTERTAINMENT',
  'AGRICULTURE',
  'TECHNOLOGY',
  'OTHER',
] as const;
export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];

export const BUSINESS_CATEGORY_LABELS: Record<BusinessCategory, string> = {
  RETAIL: 'Retail & shops',
  FOOD_AND_DRINK: 'Food & drink',
  SERVICES: 'Services',
  TRANSPORT: 'Transport',
  HEALTH: 'Health & pharmacy',
  EDUCATION: 'Education',
  ENTERTAINMENT: 'Entertainment',
  AGRICULTURE: 'Agriculture',
  TECHNOLOGY: 'Technology',
  OTHER: 'Other',
};

export const TRANSACTION_TYPES = [
  'TRANSFER',
  'REQUEST_PAYMENT',
  'SPLIT_PAYMENT',
  'BUSINESS_PAYMENT',
  'FUNDING',
  'ADJUSTMENT',
  'REVERSAL',
] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  TRANSFER: 'Transfer',
  REQUEST_PAYMENT: 'Request payment',
  SPLIT_PAYMENT: 'Bill split payment',
  BUSINESS_PAYMENT: 'Business payment',
  FUNDING: 'Demo funds',
  ADJUSTMENT: 'Balance adjustment',
  REVERSAL: 'Reversal',
};

export const TRANSACTION_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const WALLET_STATUSES = ['ACTIVE', 'FROZEN'] as const;
export type WalletStatus = (typeof WALLET_STATUSES)[number];

export const WALLET_TYPES = ['PERSONAL', 'BUSINESS', 'TREASURY'] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

export const PAYMENT_REQUEST_STATUSES = [
  'PENDING',
  'PAID',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
] as const;
export type PaymentRequestStatus = (typeof PAYMENT_REQUEST_STATUSES)[number];

export const BILL_SPLIT_STATUSES = ['OPEN', 'SETTLED', 'CANCELLED'] as const;
export type BillSplitStatus = (typeof BILL_SPLIT_STATUSES)[number];

export const SPLIT_METHODS = ['EQUAL', 'CUSTOM'] as const;
export type SplitMethod = (typeof SPLIT_METHODS)[number];

export const PARTICIPANT_STATUSES = [
  'PENDING',
  'PAID',
  'DECLINED',
  'SETTLED_SELF',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];
