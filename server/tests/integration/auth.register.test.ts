import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import {
  getRefreshCookie,
  newBusinessInput,
  newUserInput,
  TEST_PASSWORD,
  TEST_PIN,
} from '../helpers/auth.js';

const app = createApp();
const register = (body: object) => request(app).post('/api/auth/register').send(body);

beforeEach(resetDatabase);

describe('POST /api/auth/register', () => {
  it('creates the account, wallet, QR code and session', async () => {
    const input = newUserInput({ username: '@Caleb254', fullName: 'Caleb Chimera' });
    const res = await register(input);

    expect(res.status).toBe(201);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.user).toMatchObject({
      username: 'caleb254',
      fullName: 'Caleb Chimera',
      role: 'USER',
      status: 'ACTIVE',
      isDemo: true,
      defaultVisibility: 'PRIVATE',
      business: null,
    });
    expect(res.body.data.accessToken).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({
      where: { username: 'caleb254' },
      include: { wallet: true, qrCodes: true, sessions: true },
    });
    expect(user.wallet).toMatchObject({ type: 'PERSONAL', currency: 'KES' });
    expect(user.wallet!.balance.toFixed(2)).toBe('0.00');
    expect(user.qrCodes).toHaveLength(1);
    expect(user.qrCodes[0]).toMatchObject({ type: 'STATIC', isActive: true });
    expect(user.sessions).toHaveLength(1);
  });

  it('normalises the phone number to +254 format', async () => {
    const res = await register(newUserInput({ phone: '0798 765 432' }));
    expect(res.body.data.user.phone).toBe('+254798765432');
  });

  it('stores only argon2id hashes, never the password or PIN', async () => {
    const res = await register(newUserInput());
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.body.data.user.id } });

    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.pinHash).toMatch(/^\$argon2id\$/);
    expect(user.passwordHash).not.toContain(TEST_PASSWORD);
    expect(user.pinHash).not.toBe(user.passwordHash);

    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/argon2|passwordHash|pinHash|tokenVersion|failedLoginCount/);
    expect(body).not.toContain(TEST_PIN);
  });

  it('sets a hardened refresh cookie scoped to the auth endpoints', async () => {
    const res = await register(newUserInput());
    const header = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
      c.startsWith('refresh_token='),
    )!;

    expect(getRefreshCookie(res)).toBeDefined();
    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Strict/i);
    expect(header).toMatch(/Path=\/api\/auth/);
    expect(res.body.data).not.toHaveProperty('refreshToken');
  });

  it('records an audit entry', async () => {
    const res = await register(newUserInput());
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'USER_REGISTERED', entityId: res.body.data.user.id },
    });
    expect(audit).not.toBeNull();
  });

  it.each([
    [
      'username',
      { username: 'TAKEN_name' },
      { username: 'taken_name' },
      ERROR_CODES.USERNAME_TAKEN,
    ],
    [
      'email',
      { email: 'dup@example.test' },
      { email: 'DUP@example.test' },
      ERROR_CODES.EMAIL_TAKEN,
    ],
    ['phone', { phone: '0700111222' }, { phone: '+254 700 111 222' }, ERROR_CODES.PHONE_TAKEN],
  ])('rejects a duplicate %s (case/format-insensitive)', async (field, first, second, code) => {
    expect((await register(newUserInput(first))).status).toBe(201);
    const res = await register(newUserInput(second));

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(code);
    expect(res.body.error.details).toEqual([{ path: field, message: expect.any(String) }]);
  });

  it('handles concurrent registrations for the same username', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => register(newUserInput({ username: 'race_winner' }))),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await prisma.user.count({ where: { username: 'race_winner' } })).toBe(1);
  });

  it.each([
    ['a weak password', { password: 'password' }, 'password'],
    ['a trivial PIN', { pin: '1234' }, 'pin'],
    ['a reserved username', { username: 'admin' }, 'username'],
    ['a non-Kenyan phone', { phone: '+255712345678' }, 'phone'],
    ['an invalid e-mail', { email: 'not-an-email' }, 'email'],
  ])('rejects %s with a field error', async (_label, override, path) => {
    const res = await register(newUserInput(override));

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.details).toContainEqual({ path, message: expect.any(String) });
  });

  it('ignores attempts to self-assign a role or balance', async () => {
    const res = await register({ ...newUserInput(), role: 'ADMIN', balance: '1000000.00' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('USER');
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: res.body.data.user.id },
    });
    expect(wallet.balance.toFixed(2)).toBe('0.00');
  });
});

describe('POST /api/auth/register/business', () => {
  it('creates a BUSINESS account with a profile and business wallet', async () => {
    const res = await request(app)
      .post('/api/auth/register/business')
      .send(newBusinessInput({ username: 'visiblegeneral' }));

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      role: 'BUSINESS',
      username: 'visiblegeneral',
      fullName: 'Visible General Supplies Ltd',
      business: {
        businessName: 'Visible General Supplies Ltd',
        category: 'RETAIL',
        location: 'Nairobi CBD',
        isVerified: false,
      },
    });
    const wallet = await prisma.wallet.findUniqueOrThrow({
      where: { userId: res.body.data.user.id },
    });
    expect(wallet.type).toBe('BUSINESS');
  });

  it('rejects an unknown category', async () => {
    const res = await request(app)
      .post('/api/auth/register/business')
      .send({ ...newBusinessInput(), category: 'CASINO' });
    expect(res.status).toBe(422);
    expect(res.body.error.details).toContainEqual({
      path: 'category',
      message: expect.any(String),
    });
  });
});
