import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { newBusinessInput, registerUser, TEST_PIN, type RegisteredUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { balanceOf, fundUser } from '../helpers/money.js';

const app = createApp();
const auth = (user: { accessToken: string }) => ({ Authorization: `Bearer ${user.accessToken}` });

let shop: { userId: string; accessToken: string };
let caleb: RegisteredUser;
let john: RegisteredUser;

async function pay(customer: RegisteredUser, amount: string, note?: string) {
  const res = await request(app)
    .post(`/api/businesses/${shop.userId}/pay`)
    .set(auth(customer))
    .set('Idempotency-Key', `k-${randomUUID()}`)
    .send({ amount, pin: TEST_PIN, ...(note ? { note } : {}) });
  return res;
}

beforeEach(async () => {
  await resetDatabase();
  // POST /api/businesses is the spec's "create business" endpoint.
  const created = await request(app)
    .post('/api/businesses')
    .send(
      newBusinessInput({
        username: 'visiblegeneral',
        businessName: 'Visible General Supplies Ltd',
      }),
    );
  expect(created.status).toBe(201);
  shop = { userId: created.body.data.user.id, accessToken: created.body.data.accessToken };
  caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
  john = await registerUser(app, { username: 'john254', fullName: 'John Kamau' });
  await fundUser(caleb.userId, '20000.00');
  await fundUser(john.userId, '20000.00');
});

describe('GET /api/businesses/:username', () => {
  it('returns the public business card without contact details', async () => {
    const res = await request(app).get('/api/businesses/visiblegeneral').set(auth(caleb));
    expect(res.body.data).toMatchObject({
      kind: 'business',
      username: 'visiblegeneral',
      businessName: 'Visible General Supplies Ltd',
      category: 'RETAIL',
      location: 'Nairobi CBD',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/@example\.test|\+254|balance|registrationNumber/);
  });

  it('404s for personal accounts and unknown names', async () => {
    expect((await request(app).get('/api/businesses/caleb254').set(auth(caleb))).status).toBe(404);
    expect((await request(app).get('/api/businesses/nobody_here').set(auth(caleb))).status).toBe(
      404,
    );
  });
});

describe('POST /api/businesses/:id/pay', () => {
  it('pays the business as a BUSINESS_PAYMENT', async () => {
    const res = await pay(caleb, '3500', 'Stationery');
    expect(res.status).toBe(201);
    expect(res.body.data.transaction).toMatchObject({
      type: 'BUSINESS_PAYMENT',
      amount: '3500.00',
      visibility: 'PRIVATE',
      recipient: { kind: 'business', username: 'visiblegeneral' },
    });
    expect(await balanceOf(shop.userId)).toBe('3500.00');
  });

  it('is idempotent and PIN-protected', async () => {
    const key = `k-${randomUUID()}`;
    const send = () =>
      request(app)
        .post(`/api/businesses/${shop.userId}/pay`)
        .set(auth(caleb))
        .set('Idempotency-Key', key)
        .send({ amount: '100', pin: TEST_PIN });
    await send();
    const replay = await send();
    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(await balanceOf(shop.userId)).toBe('100.00');

    const wrongPin = await request(app)
      .post(`/api/businesses/${shop.userId}/pay`)
      .set(auth(caleb))
      .set('Idempotency-Key', `k-${randomUUID()}`)
      .send({ amount: '100', pin: '9999' });
    expect(wrongPin.body.error.code).toBe(ERROR_CODES.INVALID_PIN);
  });

  it('404s when the id is not a business', async () => {
    const res = await request(app)
      .post(`/api/businesses/${john.userId}/pay`)
      .set(auth(caleb))
      .set('Idempotency-Key', `k-${randomUUID()}`)
      .send({ amount: '100', pin: TEST_PIN });
    expect(res.status).toBe(404);
    expect(await balanceOf(john.userId)).toBe('20000.00');
  });
});

describe('business dashboard & analytics', () => {
  beforeEach(async () => {
    await pay(caleb, '3500');
    await pay(caleb, '1500');
    await pay(john, '800');
    // A pending payment request the business sent.
    await request(app)
      .post('/api/payment-requests')
      .set(auth(shop))
      .send({ payer: 'john254', amount: '3200', note: 'Invoice 7' });
  });

  it('summarises today: sales, transactions, customers and pending requests', async () => {
    const res = await request(app).get('/api/businesses/me/dashboard').set(auth(shop));
    expect(res.body.data).toEqual({
      today: { sales: '5800.00', transactions: 3, customers: 2 },
      totalCustomers: 2,
      pendingRequests: { count: 1, amount: '3200.00' },
      balance: '5800.00',
    });
  });

  it('only counts customer payments as sales (not demo funding)', async () => {
    await fundUser(shop.userId, '50000.00');
    const res = await request(app).get('/api/businesses/me/dashboard').set(auth(shop));
    expect(res.body.data.today.sales).toBe('5800.00');
    expect(res.body.data.balance).toBe('55800.00');
  });

  it('builds a daily series with totals and top customers', async () => {
    const res = await request(app).get('/api/businesses/me/analytics?days=7').set(auth(shop));
    const data = res.body.data;
    expect(data).toMatchObject({
      periodDays: 7,
      totalSales: '5800.00',
      previousPeriodSales: '0.00',
      transactions: 3,
      averageSale: '1933.33',
      uniqueCustomers: 2,
    });
    expect(data.daily).toHaveLength(7);
    expect(data.daily.at(-1)).toMatchObject({ sales: '5800.00', transactions: 3 });
    expect(
      data.topCustomers.map((c: { customer: { username: string }; total: string }) => [
        c.customer.username,
        c.total,
      ]),
    ).toEqual([
      ['caleb254', '5000.00'],
      ['john254', '800.00'],
    ]);
  });

  it('rejects unsupported periods', async () => {
    expect(
      (await request(app).get('/api/businesses/me/analytics?days=12').set(auth(shop))).status,
    ).toBe(422);
  });

  it('lists customers with totals, most recent first, paginated', async () => {
    const page1 = await request(app).get('/api/businesses/me/customers?limit=1').set(auth(shop));
    expect(page1.body.data).toMatchObject({ page: 1, totalItems: 2, totalPages: 2 });
    expect(page1.body.data.items[0]).toMatchObject({
      customer: { username: 'john254' },
      totalSpent: '800.00',
      payments: 1,
    });

    const page2 = await request(app)
      .get('/api/businesses/me/customers?limit=1&page=2')
      .set(auth(shop));
    expect(page2.body.data.items[0]).toMatchObject({
      customer: { username: 'caleb254' },
      totalSpent: '5000.00',
      payments: 2,
    });
    expect(JSON.stringify(page2.body)).not.toMatch(/@example\.test|\+254/);
  });

  it('is only for business accounts', async () => {
    for (const path of ['dashboard', 'analytics', 'customers']) {
      expect((await request(app).get(`/api/businesses/me/${path}`).set(auth(caleb))).status).toBe(
        403,
      );
    }
  });
});

describe('PATCH /api/businesses/me', () => {
  it('updates details and keeps the display name in sync', async () => {
    const res = await request(app).patch('/api/businesses/me').set(auth(shop)).send({
      businessName: 'Visible General Hardware',
      location: 'Moi Avenue, Nairobi',
      description: 'Tools and paint.',
    });
    expect(res.body.data).toMatchObject({
      fullName: 'Visible General Hardware',
      business: {
        businessName: 'Visible General Hardware',
        location: 'Moi Avenue, Nairobi',
        description: 'Tools and paint.',
      },
    });
    expect(await prisma.auditLog.count({ where: { action: 'BUSINESS_UPDATED' } })).toBe(1);
  });

  it('clears optional fields when sent empty, and leaves omitted fields alone', async () => {
    await request(app)
      .patch('/api/businesses/me')
      .set(auth(shop))
      .send({ description: 'Tools.', registrationNumber: 'PVT-123' });
    const cleared = await request(app)
      .patch('/api/businesses/me')
      .set(auth(shop))
      .send({ description: '' });
    expect(cleared.body.data.business).toMatchObject({
      description: null,
      registrationNumber: 'PVT-123',
    });
  });

  it('validates fields and requires at least one change', async () => {
    expect((await request(app).patch('/api/businesses/me').set(auth(shop)).send({})).status).toBe(
      422,
    );
    expect(
      (await request(app).patch('/api/businesses/me').set(auth(shop)).send({ category: 'CASINO' }))
        .status,
    ).toBe(422);
  });
});
