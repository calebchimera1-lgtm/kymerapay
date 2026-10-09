import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { fingerprint } from '../../src/middleware/idempotency.js';
import { idempotencyRepository } from '../../src/repositories/idempotency.repository.js';
import { runInTransaction } from '../../src/utils/transaction.js';
import { reconcileLedger } from '../../src/services/reconciliation.service.js';
import { registerUser, TEST_PIN, type RegisteredUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { balanceOf, fundUser } from '../helpers/money.js';

const app = createApp();

const newKey = () => `test-${randomUUID()}`;

function transfer(
  user: RegisteredUser,
  body: Record<string, unknown>,
  key: string | null = newKey(),
) {
  const req = request(app)
    .post('/api/transfers')
    .set('Authorization', `Bearer ${user.accessToken}`);
  if (key) req.set('Idempotency-Key', key);
  return req.send({ pin: TEST_PIN, ...body });
}

let caleb: RegisteredUser;
let john: RegisteredUser;

beforeEach(async () => {
  await resetDatabase();
  caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
  john = await registerUser(app, { username: 'john254', fullName: 'John Kamau' });
  await fundUser(caleb.userId, '25000.00');
});

describe('POST /api/transfers', () => {
  it('sends money and returns a receipt with the new balance', async () => {
    const res = await transfer(caleb, { recipient: '@John254', amount: '1,500', note: 'Lunch 😂' });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      balance: '23500.00',
      transaction: {
        reference: expect.stringMatching(/^TXN-/),
        type: 'TRANSFER',
        amount: '1500.00',
        note: 'Lunch 😂',
        visibility: 'PRIVATE',
        recipient: { kind: 'person', displayName: 'John Kamau', username: 'john254' },
      },
    });
    expect(await balanceOf(caleb.userId)).toBe('23500.00');
    expect(await balanceOf(john.userId)).toBe('1500.00');
  });

  it('notifies both people with the agreed wording', async () => {
    await transfer(caleb, { recipient: 'john254', amount: '2000' });

    const received = await prisma.notification.findFirstOrThrow({
      where: { userId: john.userId, type: 'MONEY_RECEIVED' },
    });
    const sent = await prisma.notification.findFirstOrThrow({
      where: { userId: caleb.userId, type: 'MONEY_SENT' },
    });
    expect(received.body).toBe('You received KSh 2,000.00 from @caleb254.');
    expect(sent.body).toBe('Your payment of KSh 2,000.00 to @john254 was successful.');
  });

  it('writes an audit entry and keeps the ledger balanced', async () => {
    const res = await transfer(caleb, { recipient: 'john254', amount: '10' });
    expect(
      await prisma.auditLog.count({
        where: { action: 'TRANSFER_COMPLETED', entityId: res.body.data.transaction.id },
      }),
    ).toBe(1);
    expect((await reconcileLedger()).healthy).toBe(true);
  });

  it('records a payment to a business as BUSINESS_PAYMENT and keeps it private', async () => {
    const shop = await request(app).post('/api/auth/register/business').send({
      businessName: 'Visible General Supplies Ltd',
      category: 'RETAIL',
      location: 'Nairobi',
      username: 'visiblegeneral',
      email: 'shop@example.test',
      phone: '0110000999',
      password: 'Sunrise2026',
      pin: '4826',
    });
    expect(shop.status).toBe(201);

    const res = await transfer(caleb, {
      recipient: 'visiblegeneral',
      amount: '3500',
      visibility: 'FRIENDS',
    });
    expect(res.body.data.transaction).toMatchObject({
      type: 'BUSINESS_PAYMENT',
      visibility: 'PRIVATE',
      recipient: { kind: 'business', displayName: 'Visible General Supplies Ltd' },
    });
  });

  it('uses the sender’s default visibility unless overridden', async () => {
    await prisma.user.update({
      where: { id: caleb.userId },
      data: { defaultVisibility: 'FRIENDS' },
    });
    const byDefault = await transfer(caleb, { recipient: 'john254', amount: '10' });
    const overridden = await transfer(caleb, {
      recipient: 'john254',
      amount: '10',
      visibility: 'PRIVATE',
    });
    expect(byDefault.body.data.transaction.visibility).toBe('FRIENDS');
    expect(overridden.body.data.transaction.visibility).toBe('PRIVATE');
  });

  describe('rejections (nothing moves)', () => {
    async function expectRejected(body: Record<string, unknown>, status: number, code: string) {
      const res = await transfer(caleb, body);
      expect(res.status).toBe(status);
      expect(res.body.error.code).toBe(code);
      expect(await balanceOf(caleb.userId)).toBe('25000.00');
      expect(await prisma.transaction.count({ where: { type: 'TRANSFER' } })).toBe(0);
    }

    it('insufficient balance', () =>
      expectRejected(
        { recipient: 'john254', amount: '25000.01' },
        422,
        ERROR_CODES.INSUFFICIENT_BALANCE,
      ));

    it('unknown recipient', () =>
      expectRejected(
        { recipient: 'nobody_here', amount: '10' },
        404,
        ERROR_CODES.RECIPIENT_NOT_FOUND,
      ));

    it('sending to yourself', () =>
      expectRejected({ recipient: 'caleb254', amount: '10' }, 422, ERROR_CODES.SELF_TRANSFER));

    it('below the minimum', () =>
      expectRejected(
        { recipient: 'john254', amount: '0.50' },
        422,
        ERROR_CODES.AMOUNT_OUT_OF_RANGE,
      ));

    it('above the per-transaction maximum', () =>
      expectRejected(
        { recipient: 'john254', amount: '150000.01' },
        422,
        ERROR_CODES.AMOUNT_OUT_OF_RANGE,
      ));

    it('a malformed amount', () =>
      expectRejected(
        { recipient: 'john254', amount: '12.345' },
        422,
        ERROR_CODES.VALIDATION_ERROR,
      ));

    it('a wrong PIN', () =>
      expectRejected(
        { recipient: 'john254', amount: '10', pin: '9999' },
        403,
        ERROR_CODES.INVALID_PIN,
      ));

    it('a suspended recipient', async () => {
      await prisma.user.update({ where: { id: john.userId }, data: { status: 'SUSPENDED' } });
      await expectRejected(
        { recipient: 'john254', amount: '10' },
        422,
        ERROR_CODES.RECIPIENT_UNAVAILABLE,
      );
    });

    it('a note over 140 characters', () =>
      expectRejected(
        { recipient: 'john254', amount: '10', note: 'x'.repeat(141) },
        422,
        ERROR_CODES.VALIDATION_ERROR,
      ));
  });

  it('enforces the daily sending limit (KSh 300,000)', async () => {
    await fundUser(caleb.userId, '400000.00');
    expect((await transfer(caleb, { recipient: 'john254', amount: '150000' })).status).toBe(201);
    expect((await transfer(caleb, { recipient: 'john254', amount: '149000' })).status).toBe(201);

    const over = await transfer(caleb, { recipient: 'john254', amount: '1000.01' });
    expect(over.status).toBe(422);
    expect(over.body.error).toMatchObject({
      code: ERROR_CODES.DAILY_LIMIT_EXCEEDED,
      message: expect.stringContaining('You can send up to KSh 1,000.00 more today.'),
    });
    expect((await transfer(caleb, { recipient: 'john254', amount: '1000' })).status).toBe(201);
  });

  it('enforces the daily limit under concurrency', async () => {
    await fundUser(caleb.userId, '400000.00');
    const results = await Promise.all(
      Array.from({ length: 4 }, () => transfer(caleb, { recipient: 'john254', amount: '100000' })),
    );
    expect(results.filter((r) => r.status === 201)).toHaveLength(3);
    expect(
      results.filter((r) => r.body.error?.code === ERROR_CODES.DAILY_LIMIT_EXCEEDED),
    ).toHaveLength(1);
  });

  describe('authorization', () => {
    it('requires sign-in', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Idempotency-Key', newKey())
        .send({});
      expect(res.status).toBe(401);
    });

    it('is not available to business accounts or admins', async () => {
      await prisma.user.update({ where: { id: john.userId }, data: { role: 'BUSINESS' } });
      const res = await transfer(john, { recipient: 'caleb254', amount: '10' });
      expect(res.status).toBe(403);
    });

    it('cannot be pointed at someone else’s wallet: the sender is always the caller', async () => {
      const res = await transfer(john, { recipient: 'caleb254', amount: '10', from: caleb.userId });
      expect(res.body.error.code).toBe(ERROR_CODES.INSUFFICIENT_BALANCE);
      expect(await balanceOf(caleb.userId)).toBe('25000.00');
    });
  });
});

describe('idempotency', () => {
  it('requires an Idempotency-Key', async () => {
    const res = await transfer(caleb, { recipient: 'john254', amount: '10' }, null);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });

  it('rejects a malformed key', async () => {
    const res = await transfer(caleb, { recipient: 'john254', amount: '10' }, 'short');
    expect(res.status).toBe(400);
  });

  it('replays the original response instead of paying twice', async () => {
    const key = newKey();
    const first = await transfer(caleb, { recipient: 'john254', amount: '1500' }, key);
    const second = await transfer(caleb, { recipient: 'john254', amount: '1,500.00' }, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(await balanceOf(caleb.userId)).toBe('23500.00');
    expect(await prisma.transaction.count({ where: { type: 'TRANSFER' } })).toBe(1);
  });

  it('refuses to reuse a key for a different payment', async () => {
    const key = newKey();
    await transfer(caleb, { recipient: 'john254', amount: '1500' }, key);
    const res = await transfer(caleb, { recipient: 'john254', amount: '2000' }, key);

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe(ERROR_CODES.IDEMPOTENCY_KEY_REUSED);
    expect(await balanceOf(caleb.userId)).toBe('23500.00');
  });

  it('moves money exactly once when the same request is fired concurrently', async () => {
    const key = newKey();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        transfer(caleb, { recipient: 'john254', amount: '1000' }, key),
      ),
    );

    const created = results.filter((r) => r.status === 201);
    const inProgress = results.filter((r) => r.status === 409);
    expect(created.length + inProgress.length).toBe(6);
    expect(created.length).toBeGreaterThanOrEqual(1);
    for (const r of inProgress) expect(r.body.error.code).toBe(ERROR_CODES.REQUEST_IN_PROGRESS);
    // Every 201 is the same transaction.
    expect(new Set(created.map((r) => r.body.data.transaction.reference)).size).toBe(1);
    expect(await prisma.transaction.count({ where: { type: 'TRANSFER' } })).toBe(1);
    expect(await balanceOf(caleb.userId)).toBe('24000.00');
  });

  it('releases the key after a failure so a corrected retry can succeed', async () => {
    const key = newKey();
    const wrongPin = await transfer(
      caleb,
      { recipient: 'john254', amount: '10', pin: '9999' },
      key,
    );
    expect(wrongPin.status).toBe(403);

    const retry = await transfer(caleb, { recipient: 'john254', amount: '10' }, key);
    expect(retry.status).toBe(201);
    expect(retry.headers['idempotent-replayed']).toBeUndefined();
  });

  it('scopes keys per user', async () => {
    const key = newKey();
    await fundUser(john.userId, '100.00');
    expect((await transfer(caleb, { recipient: 'john254', amount: '10' }, key)).status).toBe(201);
    expect((await transfer(john, { recipient: 'caleb254', amount: '10' }, key)).status).toBe(201);
  });

  describe('abandoned reservations', () => {
    // The validated body the server fingerprints (PIN excluded).
    const body = { recipient: 'john254', amount: '10.00' };
    const hash = () => fingerprint('transfers.create', 'POST', '/api/transfers', body);

    async function reservation(key: string, ageMs: number) {
      const at = new Date(Date.now() - ageMs);
      return prisma.idempotencyKey.create({
        data: {
          userId: caleb.userId,
          key,
          endpoint: 'transfers.create',
          requestHash: hash(),
          expiresAt: new Date(Date.now() + 3_600_000),
          createdAt: at,
          updatedAt: at,
        },
      });
    }

    it('answers 409 while a reservation is fresh', async () => {
      const key = newKey();
      await reservation(key, 1_000);
      const res = await transfer(caleb, { recipient: 'john254', amount: '10' }, key);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe(ERROR_CODES.REQUEST_IN_PROGRESS);
    });

    it('takes over a reservation left behind by a crashed request', async () => {
      const key = newKey();
      await reservation(key, 3 * 60_000);
      const res = await transfer(caleb, { recipient: 'john254', amount: '10' }, key);
      expect(res.status).toBe(201);
      expect(await prisma.transaction.count({ where: { type: 'TRANSFER' } })).toBe(1);
    });

    it('fences out the original holder after a takeover', async () => {
      const key = newKey();
      const stale = await reservation(key, 3 * 60_000);
      await transfer(caleb, { recipient: 'john254', amount: '10' }, key);

      // The crashed request "wakes up" and tries to complete with its old fence.
      await expect(
        runInTransaction((tx) =>
          idempotencyRepository.complete(tx, { id: stale.id, fence: stale.updatedAt }, 201, {}),
        ),
      ).rejects.toMatchObject({ code: ERROR_CODES.REQUEST_IN_PROGRESS });
    });
  });

  it('does not store the PIN, even hashed, in the idempotency record', async () => {
    const key = newKey();
    await transfer(caleb, { recipient: 'john254', amount: '10' }, key);
    const record = await prisma.idempotencyKey.findFirstOrThrow({ where: { key } });
    expect(JSON.stringify(record)).not.toContain(TEST_PIN);
    expect(record).toMatchObject({ status: 'COMPLETED', responseCode: 201 });
    expect(record.transactionId).not.toBeNull();
  });
});

describe('GET /api/transfers/recent-recipients', () => {
  it('lists distinct recent recipients, newest first, without private data', async () => {
    await registerUser(app, { username: 'brian254', fullName: 'Brian Otieno' });
    await transfer(caleb, { recipient: 'john254', amount: '10' });
    await transfer(caleb, { recipient: 'brian254', amount: '10' });
    await transfer(caleb, { recipient: 'john254', amount: '10' });

    const res = await request(app)
      .get('/api/transfers/recent-recipients')
      .set('Authorization', `Bearer ${caleb.accessToken}`);
    expect(res.body.data.map((p: { username: string }) => p.username)).toEqual([
      'john254',
      'brian254',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/email|phone|balance/);
  });
});
