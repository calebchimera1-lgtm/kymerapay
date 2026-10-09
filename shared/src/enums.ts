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
