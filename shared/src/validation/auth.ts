import { z } from 'zod';
import { BUSINESS_CATEGORIES } from '../enums.js';
import { normalizeKenyanPhone } from './phone.js';

/** Handles that would be confusing or could be used to impersonate the platform. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'help',
  'security',
  'kespay',
  'official',
  'staff',
  'moderator',
  'treasury',
  'billing',
  'payments',
  'mpesa',
  'safaricom',
  'airtel',
  'cbk',
  'bank',
  'api',
  'null',
  'undefined',
]);

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(100, 'Name is too long.')
  .regex(/^\p{L}[\p{L}\p{M}' .-]*$/u, 'Use letters, spaces, apostrophes or hyphens only.');

/** Accepts "@Caleb254" or "caleb254"; outputs "caleb254". */
export const usernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, '').toLowerCase())
  .pipe(
    z
      .string()
      .min(3, 'Username must be at least 3 characters.')
      .max(20, 'Username must be at most 20 characters.')
      .regex(/^[a-z0-9_]+$/, 'Use letters, numbers and underscores only.')
      .regex(/[a-z]/, 'Username must contain at least one letter.')
      .refine((value) => !RESERVED_USERNAMES.has(value), 'That username is reserved.'),
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'E-mail is too long.')
  .pipe(z.email('Enter a valid e-mail address.'));

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeKenyanPhone(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Enter a Kenyan mobile number, e.g. 0712 345 678.',
      });
      return z.NEVER;
    }
    return normalized;
  });

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/\p{L}/u, 'Password must contain a letter.')
  .regex(/\d/, 'Password must contain a number.');

const SEQUENTIAL_DIGITS = '01234567890';
const REVERSE_SEQUENTIAL_DIGITS = '09876543210';

/** 4-digit transaction PIN; rejects trivially guessable PINs. */
export const pinSchema = z
  .string()
  .regex(/^\d{4}$/, 'PIN must be exactly 4 digits.')
  .refine((pin) => !/^(\d)\1{3}$/.test(pin), 'PIN cannot be the same digit repeated.')
  .refine(
    (pin) => !SEQUENTIAL_DIGITS.includes(pin) && !REVERSE_SEQUENTIAL_DIGITS.includes(pin),
    'PIN cannot be a sequence like 1234.',
  );

export const registerUserSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  pin: pinSchema,
});
export type RegisterUserInput = z.input<typeof registerUserSchema>;
export type RegisterUserData = z.output<typeof registerUserSchema>;

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((value) => (value ? value : undefined));

export const businessDetailsSchema = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, 'Enter the business name.')
    .max(120, 'Business name is too long.'),
  category: z.enum(BUSINESS_CATEGORIES, 'Choose a business category.'),
  location: z
    .string()
    .trim()
    .min(2, 'Enter the business location.')
    .max(120, 'Location is too long.'),
  description: optionalText(500, 'Description must be at most 500 characters.'),
  registrationNumber: optionalText(40, 'Registration number is too long.').refine(
    (value) => value === undefined || /^[A-Za-z0-9/-]+$/.test(value),
    'Use letters, numbers, "/" or "-" only.',
  ),
});

export const registerBusinessSchema = businessDetailsSchema.extend({
  username: usernameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  pin: pinSchema,
});
export type RegisterBusinessInput = z.input<typeof registerBusinessSchema>;
export type RegisterBusinessData = z.output<typeof registerBusinessSchema>;

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Enter your e-mail, phone number or username.')
    .max(254, 'That is too long.'),
  password: z.string().min(1, 'Enter your password.').max(128, 'Password is too long.'),
});
export type LoginInput = z.input<typeof loginSchema>;

export const verifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits.'),
});
export type VerifyPinInput = z.input<typeof verifyPinSchema>;
