import {
  BUSINESS_CATEGORIES,
  normalizeKenyanPhone,
  pinSchema,
  passwordSchema,
  registerUserSchema,
  ROLES,
  USER_STATUSES,
  usernameSchema,
  VISIBILITIES,
} from '@app/shared';
import { describe, expect, it } from 'vitest';
import {
  BusinessCategory,
  Role,
  UserStatus,
  Visibility,
} from '../../src/generated/prisma/client.js';
import { resolveLoginIdentifier } from '../../src/repositories/user.repository.js';

describe('normalizeKenyanPhone', () => {
  it.each([
    ['0712345678', '+254712345678'],
    ['0712 345 678', '+254712345678'],
    ['712345678', '+254712345678'],
    ['254712345678', '+254712345678'],
    ['+254712345678', '+254712345678'],
    ['+254 712-345-678', '+254712345678'],
    ['0112345678', '+254112345678'],
    ['+254112345678', '+254112345678'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(['0812345678', '+255712345678', '07123456', '07123456789', 'abc', ''])(
    'rejects %s',
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    },
  );
});

describe('usernameSchema', () => {
  it('strips @ and lowercases', () => {
    expect(usernameSchema.parse('@Caleb254')).toBe('caleb254');
  });

  it.each(['ab', 'a'.repeat(21), 'bad-name', 'has space', '12345', 'admin', '@kespay'])(
    'rejects %s',
    (input) => {
      expect(usernameSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe('pinSchema', () => {
  it.each(['4826', '1357', '9024'])('accepts %s', (pin) => {
    expect(pinSchema.safeParse(pin).success).toBe(true);
  });

  it.each(['0000', '1111', '1234', '4321', '7890', '123', '12345', '12a4'])('rejects %s', (pin) => {
    expect(pinSchema.safeParse(pin).success).toBe(false);
  });
});

describe('passwordSchema', () => {
  it.each(['short1', 'onlyletters', '1234567890'])('rejects %s', (password) => {
    expect(passwordSchema.safeParse(password).success).toBe(false);
  });

  it('accepts a password with letters and digits', () => {
    expect(passwordSchema.safeParse('Sunrise2026').success).toBe(true);
  });
});

describe('registerUserSchema', () => {
  it('normalises every field', () => {
    const parsed = registerUserSchema.parse({
      fullName: '  Caleb Chimera ',
      username: '@Caleb254',
      email: ' Caleb@Example.COM ',
      phone: '0712 345 678',
      password: 'Sunrise2026',
      pin: '4826',
    });
    expect(parsed).toEqual({
      fullName: 'Caleb Chimera',
      username: 'caleb254',
      email: 'caleb@example.com',
      phone: '+254712345678',
      password: 'Sunrise2026',
      pin: '4826',
    });
  });
});

describe('resolveLoginIdentifier', () => {
  it.each([
    ['Caleb@Example.com', { field: 'email', value: 'caleb@example.com' }],
    ['0712345678', { field: 'phone', value: '+254712345678' }],
    ['+254 712 345 678', { field: 'phone', value: '+254712345678' }],
    ['@Caleb254', { field: 'username', value: 'caleb254' }],
    ['caleb254', { field: 'username', value: 'caleb254' }],
  ])('%s', (identifier, expected) => {
    expect(resolveLoginIdentifier(identifier)).toEqual(expected);
  });
});

describe('shared enums match the database enums', () => {
  it.each([
    ['Role', ROLES, Role],
    ['UserStatus', USER_STATUSES, UserStatus],
    ['Visibility', VISIBILITIES, Visibility],
    ['BusinessCategory', BUSINESS_CATEGORIES, BusinessCategory],
  ])('%s', (_name, shared, prismaEnum) => {
    expect([...shared].sort()).toEqual(Object.values(prismaEnum).sort());
  });
});
