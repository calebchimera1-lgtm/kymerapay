import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { postTransfer } from '../../src/services/ledger.service.js';
import { money } from '../../src/utils/money.js';
import { runInTransaction } from '../../src/utils/transaction.js';
import { registerUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { fundUser, walletIdOf } from '../helpers/money.js';

const app = createApp();
const get = (path: string, token: string) =>
  request(app).get(path).set('Authorization', `Bearer ${token}`);

async function send(fromUserId: string, toUserId: string, amount: string, note?: string) {
  const [fromWalletId, toWalletId] = await Promise.all([
    walletIdOf(fromUserId),
    walletIdOf(toUserId),
  ]);
  return runInTransaction((tx) =>
    postTransfer(tx, {
      type: 'TRANSFER',
      fromWalletId,
      toWalletId,
      amount: money(amount),
      initiatorId: fromUserId,
      note: note ?? null,
    }),
  );
}

beforeEach(resetDatabase);

describe('GET /api/wallet', () => {
  it('returns the caller’s balance as a 2-dp string', async () => {
    const user = await registerUser(app);
    await fundUser(user.userId, '24850.00');

    const res = await get('/api/wallet', user.accessToken);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.data).toMatchObject({
      currency: 'KES',
      balance: '24850.00',
      status: 'ACTIVE',
      type: 'PERSONAL',
    });
  });

  it('requires authentication', async () => {
    expect((await request(app).get('/api/wallet')).status).toBe(401);
  });

  it('is unavailable to admins, who hold no wallet', async () => {
    const admin = await registerUser(app);
    await prisma.user.update({
      where: { id: admin.userId },
      data: { role: 'ADMIN', pinHash: null },
    });
    expect((await get('/api/wallet', admin.accessToken)).status).toBe(403);
  });
});

describe('GET /api/wallet/entries', () => {
  it('lists the statement newest-first with safe counterparty details', async () => {
    const caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
    const john = await registerUser(app, { username: 'john254', fullName: 'John Kamau' });
    await fundUser(caleb.userId, '25000.00');
    await send(caleb.userId, john.userId, '1500.00', 'Lunch 😂');

    const res = await get('/api/wallet/entries', caleb.accessToken);
    expect(res.status).toBe(200);
    const [latest, first] = res.body.data.items;

    expect(latest).toMatchObject({
      type: 'TRANSFER',
      direction: 'DEBIT',
      amount: '1500.00',
      balanceAfter: '23500.00',
      note: 'Lunch 😂',
      counterparty: { kind: 'person', displayName: 'John Kamau', username: 'john254' },
    });
    expect(first).toMatchObject({
      type: 'FUNDING',
      direction: 'CREDIT',
      amount: '25000.00',
      counterparty: { kind: 'system', displayName: 'Demo funds', username: null },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.test|\+254|phone|email/);
  });

  it('paginates with a cursor', async () => {
    const user = await registerUser(app);
    for (let i = 1; i <= 5; i += 1) await fundUser(user.userId, `${i}.00`);

    const page1 = await get('/api/wallet/entries?limit=2', user.accessToken);
    expect(page1.body.data.items.map((e: { amount: string }) => e.amount)).toEqual([
      '5.00',
      '4.00',
    ]);
    const cursor = page1.body.data.nextCursor;

    const page2 = await get(`/api/wallet/entries?limit=2&cursor=${cursor}`, user.accessToken);
    expect(page2.body.data.items.map((e: { amount: string }) => e.amount)).toEqual([
      '3.00',
      '2.00',
    ]);

    const page3 = await get(
      `/api/wallet/entries?limit=2&cursor=${page2.body.data.nextCursor}`,
      user.accessToken,
    );
    expect(page3.body.data.items.map((e: { amount: string }) => e.amount)).toEqual(['1.00']);
    expect(page3.body.data.nextCursor).toBeNull();
  });

  it('rejects a cursor from someone else’s wallet', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await fundUser(b.userId, '10.00');
    const foreign = await prisma.ledgerEntry.findFirstOrThrow({
      where: { wallet: { userId: b.userId } },
    });

    const res = await get(`/api/wallet/entries?cursor=${foreign.id}`, a.accessToken);
    expect(res.status).toBe(400);
  });

  it('validates the query', async () => {
    const user = await registerUser(app);
    expect((await get('/api/wallet/entries?limit=500', user.accessToken)).status).toBe(422);
    expect((await get('/api/wallet/entries?cursor=nope', user.accessToken)).status).toBe(422);
  });

  it('shows an empty statement for a new wallet', async () => {
    const user = await registerUser(app);
    const res = await get('/api/wallet/entries', user.accessToken);
    expect(res.body.data).toEqual({ items: [], nextCursor: null });
  });
});

describe('GET /api/wallet/summary', () => {
  it('totals money in and out over 30 days with a daily series', async () => {
    const a = await registerUser(app);
    const b = await registerUser(app);
    await fundUser(a.userId, '1000.00');
    await send(a.userId, b.userId, '250.25');
    await send(b.userId, a.userId, '50.00');

    const res = await get('/api/wallet/summary', a.accessToken);
    expect(res.body.data).toMatchObject({
      periodDays: 30,
      moneyIn: '1050.00',
      moneyOut: '250.25',
      net: '799.75',
      transactionCount: 3,
    });
    expect(res.body.data.daily).toHaveLength(30);
    const today = res.body.data.daily.at(-1);
    expect(today).toMatchObject({ moneyIn: '1050.00', moneyOut: '250.25' });
  });
});

describe('GET /api/config/public', () => {
  it('exposes the payment limits', async () => {
    const res = await request(app).get('/api/config/public');
    expect(res.body.data.limits).toEqual({
      minAmount: '1.00',
      maxAmount: '150000.00',
      dailyLimit: '300000.00',
    });
  });
});
