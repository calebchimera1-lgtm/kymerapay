import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { registerUser, TEST_PASSWORD, TEST_PIN, type RegisteredUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { balanceOf, fundUser } from '../helpers/money.js';

const app = createApp();
const auth = (user: RegisteredUser) => ({ Authorization: `Bearer ${user.accessToken}` });

let caleb: RegisteredUser;
let shop: RegisteredUser;

async function registerShop(): Promise<RegisteredUser> {
  const res = await request(app).post('/api/auth/register/business').send({
    businessName: 'Visible General Supplies Ltd',
    category: 'RETAIL',
    location: 'Nairobi',
    username: 'visiblegeneral',
    email: 'shop@example.test',
    phone: '0110000999',
    password: TEST_PASSWORD,
    pin: TEST_PIN,
  });
  const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  return {
    input: {} as never,
    userId: res.body.data.user.id,
    accessToken: res.body.data.accessToken,
    refreshCookie: cookie,
  };
}

const myQr = (user: RegisteredUser) => request(app).get('/api/qr/me').set(auth(user));
const resolve = (user: RegisteredUser, code: string) =>
  request(app).get(`/api/qr/resolve/${code}`).set(auth(user));
const generate = (user: RegisteredUser, body: object) =>
  request(app).post('/api/qr/generate').set(auth(user)).send(body);
const payByQr = (user: RegisteredUser, body: Record<string, unknown>) =>
  request(app)
    .post('/api/transfers')
    .set(auth(user))
    .set('Idempotency-Key', `k-${randomUUID()}`)
    .send({ pin: TEST_PIN, ...body });

beforeEach(async () => {
  await resetDatabase();
  caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
  shop = await registerShop();
  await fundUser(caleb.userId, '20000.00');
});

describe('profile (static) QR', () => {
  it('every account has one stable, opaque code', async () => {
    const first = await myQr(caleb);
    const second = await myQr(caleb);
    expect(first.body.data).toMatchObject({ type: 'STATIC', isActive: true, amount: null });
    expect(first.body.data.code).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(first.body.data.payload).toBe(`kespay://pay/${first.body.data.code}`);
    expect(first.body.data.payload).not.toContain('caleb254');
    expect(second.body.data.code).toBe(first.body.data.code);
  });

  it('rotating issues a new code and kills the old one', async () => {
    const old = (await myQr(caleb)).body.data.code;
    const rotated = await generate(caleb, { type: 'STATIC' });
    expect(rotated.status).toBe(201);
    expect(rotated.body.data.code).not.toBe(old);

    const stale = await resolve(shop, old);
    expect(stale.status).toBe(404);
    expect(stale.body.error.code).toBe(ERROR_CODES.QR_INVALID);
    expect((await resolve(shop, rotated.body.data.code)).status).toBe(200);
  });
});

describe('resolving a scanned code', () => {
  it('returns only the payee’s public profile and counts the scan', async () => {
    const { code } = (await myQr(shop)).body.data;
    const res = await resolve(caleb, code);

    expect(res.body.data).toEqual({
      code,
      type: 'STATIC',
      payee: {
        id: shop.userId,
        kind: 'business',
        displayName: 'Visible General Supplies Ltd',
        username: 'visiblegeneral',
        avatarUrl: null,
        businessCategory: 'RETAIL',
        isVerified: false,
      },
      amount: null,
      note: null,
      expiresAt: null,
      isOwn: false,
    });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.test|\+254|balance/);
    expect((await prisma.qrCode.findUniqueOrThrow({ where: { code } })).scanCount).toBe(1);
  });

  it('flags your own code', async () => {
    const { code } = (await myQr(caleb)).body.data;
    expect((await resolve(caleb, code)).body.data.isOwn).toBe(true);
  });

  it('never moves money', async () => {
    const { code } = (await myQr(shop)).body.data;
    await resolve(caleb, code);
    expect(await prisma.transaction.count({ where: { type: { not: 'FUNDING' } } })).toBe(0);
  });

  it.each([
    ['an unknown code', 'ZZZZZZZZZZZZZZZZZZZZZZZZ', 404, ERROR_CODES.QR_INVALID],
    ['a malformed code', 'not-a-code!', 422, ERROR_CODES.VALIDATION_ERROR],
  ])('rejects %s', async (_label, code, status, errorCode) => {
    const res = await resolve(caleb, encodeURIComponent(code));
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(errorCode);
  });

  it('rejects codes of suspended accounts', async () => {
    const { code } = (await myQr(shop)).body.data;
    await prisma.user.update({ where: { id: shop.userId }, data: { status: 'SUSPENDED' } });
    expect((await resolve(caleb, code)).body.error.code).toBe(ERROR_CODES.QR_INVALID);
  });
});

describe('fixed-amount (dynamic) QR', () => {
  it('only businesses can create them', async () => {
    const res = await generate(caleb, { type: 'DYNAMIC', amount: '500' });
    expect(res.status).toBe(403);
  });

  it('creates a code with amount, note and expiry', async () => {
    const res = await generate(shop, {
      type: 'DYNAMIC',
      amount: '3,500',
      note: 'Invoice 42',
      expiresInMinutes: 15,
    });
    expect(res.body.data).toMatchObject({
      type: 'DYNAMIC',
      amount: '3500.00',
      note: 'Invoice 42',
      isActive: true,
    });
    const minutes = (new Date(res.body.data.expiresAt).getTime() - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(14);
    expect(minutes).toBeLessThanOrEqual(15);

    const resolved = await resolve(caleb, res.body.data.code);
    expect(resolved.body.data).toMatchObject({
      type: 'DYNAMIC',
      amount: '3500.00',
      note: 'Invoice 42',
    });
  });

  it('rejects amounts outside the limits', async () => {
    expect((await generate(shop, { type: 'DYNAMIC', amount: '200000' })).body.error.code).toBe(
      ERROR_CODES.AMOUNT_OUT_OF_RANGE,
    );
  });

  it('expired codes cannot be resolved', async () => {
    const { code } = (await generate(shop, { type: 'DYNAMIC', amount: '100' })).body.data;
    await prisma.qrCode.update({
      where: { code },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await resolve(caleb, code);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe(ERROR_CODES.QR_EXPIRED);
  });

  it('can be listed and revoked', async () => {
    const a = (await generate(shop, { type: 'DYNAMIC', amount: '100' })).body.data;
    const b = (await generate(shop, { type: 'DYNAMIC', amount: '200' })).body.data;
    await request(app).post(`/api/qr/${a.id}/revoke`).set(auth(shop)).send();

    const list = await request(app).get('/api/qr/dynamic').set(auth(shop));
    expect(list.body.data.map((qr: { id: string }) => qr.id)).toEqual([b.id]);
    expect((await resolve(caleb, a.code)).body.error.code).toBe(ERROR_CODES.QR_INVALID);
  });
});

describe('paying by QR', () => {
  it('pays the code owner with a static QR, linking the QR to the transaction', async () => {
    const { code } = (await myQr(shop)).body.data;
    const res = await payByQr(caleb, { recipient: 'visiblegeneral', amount: '750', qrCode: code });

    expect(res.status).toBe(201);
    expect(res.body.data.transaction.type).toBe('BUSINESS_PAYMENT');
    const txn = await prisma.transaction.findUniqueOrThrow({
      where: { id: res.body.data.transaction.id },
    });
    expect(txn.qrCodeId).not.toBeNull();
    // Static codes are reusable.
    expect(
      (await payByQr(caleb, { recipient: 'visiblegeneral', amount: '50', qrCode: code })).status,
    ).toBe(201);
  });

  it('a dynamic QR must be paid with its exact amount, and only once', async () => {
    const { code } = (await generate(shop, { type: 'DYNAMIC', amount: '3500' })).body.data;

    const wrong = await payByQr(caleb, {
      recipient: 'visiblegeneral',
      amount: '3000',
      qrCode: code,
    });
    expect(wrong.status).toBe(422);
    expect(wrong.body.error.message).toBe('This QR code is for exactly KSh 3,500.00.');
    expect(await balanceOf(caleb.userId)).toBe('20000.00');

    expect(
      (await payByQr(caleb, { recipient: 'visiblegeneral', amount: '3500', qrCode: code })).status,
    ).toBe(201);
    const again = await payByQr(caleb, {
      recipient: 'visiblegeneral',
      amount: '3500',
      qrCode: code,
    });
    expect(again.body.error.code).toBe(ERROR_CODES.QR_INVALID);
    expect(await balanceOf(shop.userId)).toBe('3500.00');
  });

  it('a dynamic QR is consumed exactly once under concurrent payments', async () => {
    const { code } = (await generate(shop, { type: 'DYNAMIC', amount: '1000' })).body.data;
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        payByQr(caleb, { recipient: 'visiblegeneral', amount: '1000', qrCode: code }),
      ),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await balanceOf(shop.userId)).toBe('1000.00');
  });

  it('refuses a QR that belongs to someone other than the recipient', async () => {
    const john = await registerUser(app, { username: 'john254' });
    const { code } = (await myQr(shop)).body.data;
    const res = await payByQr(caleb, { recipient: 'john254', amount: '10', qrCode: code });
    expect(res.body.error.code).toBe(ERROR_CODES.QR_INVALID);
    expect(await balanceOf(john.userId)).toBe('0.00');
  });

  it('a wrong PIN does not consume a dynamic QR', async () => {
    const { code } = (await generate(shop, { type: 'DYNAMIC', amount: '100' })).body.data;
    expect(
      (
        await payByQr(caleb, {
          recipient: 'visiblegeneral',
          amount: '100',
          qrCode: code,
          pin: '9999',
        })
      ).status,
    ).toBe(403);
    expect((await prisma.qrCode.findUniqueOrThrow({ where: { code } })).isActive).toBe(true);
    expect(
      (await payByQr(caleb, { recipient: 'visiblegeneral', amount: '100', qrCode: code })).status,
    ).toBe(201);
  });
});
