import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { reconcileLedger } from '../../src/services/reconciliation.service.js';
import { expireOverdueRequests } from '../../src/services/paymentRequest.service.js';
import { registerUser, TEST_PIN, type RegisteredUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { balanceOf, fundUser } from '../helpers/money.js';

const app = createApp();
const auth = (user: RegisteredUser) => ({ Authorization: `Bearer ${user.accessToken}` });

function createRequest(requester: RegisteredUser, body: Record<string, unknown>) {
  return request(app).post('/api/payment-requests').set(auth(requester)).send(body);
}
function pay(payer: RegisteredUser, id: string, pin = TEST_PIN, key = `k-${randomUUID()}`) {
  return request(app)
    .post(`/api/payment-requests/${id}/pay`)
    .set(auth(payer))
    .set('Idempotency-Key', key)
    .send({ pin });
}
const decline = (payer: RegisteredUser, id: string) =>
  request(app).post(`/api/payment-requests/${id}/decline`).set(auth(payer)).send();
const cancel = (requester: RegisteredUser, id: string) =>
  request(app).post(`/api/payment-requests/${id}/cancel`).set(auth(requester)).send();

let caleb: RegisteredUser;
let john: RegisteredUser;

beforeEach(async () => {
  await resetDatabase();
  caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
  john = await registerUser(app, { username: 'john254', fullName: 'John Kamau' });
  await fundUser(john.userId, '10000.00');
});

async function newRequest(amount = '2000', note = 'Internet bill') {
  const res = await createRequest(caleb, { payer: '@john254', amount, note });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
}

describe('POST /api/payment-requests', () => {
  it('creates a pending request and notifies the payer', async () => {
    const res = await createRequest(caleb, {
      payer: 'john254',
      amount: '2,000',
      note: 'Internet bill',
    });

    expect(res.body.data).toMatchObject({
      direction: 'outgoing',
      status: 'PENDING',
      amount: '2000.00',
      note: 'Internet bill',
      counterparty: { username: 'john254', displayName: 'John Kamau' },
      billSplit: null,
    });
    const days = (new Date(res.body.data.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);

    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId: john.userId, type: 'REQUEST_RECEIVED' },
    });
    expect(notification.body).toBe('@caleb254 requested KSh 2,000.00. “Internet bill”');
  });

  it.each([
    [{ payer: 'caleb254', amount: '10' }, 422, ERROR_CODES.SELF_TRANSFER],
    [{ payer: 'nobody_here', amount: '10' }, 404, ERROR_CODES.RECIPIENT_NOT_FOUND],
    [{ payer: 'john254', amount: '0.5' }, 422, ERROR_CODES.AMOUNT_OUT_OF_RANGE],
    [{ payer: 'john254', amount: '200000' }, 422, ERROR_CODES.AMOUNT_OUT_OF_RANGE],
    [{ payer: 'john254', amount: '10', expiresInDays: 90 }, 422, ERROR_CODES.VALIDATION_ERROR],
  ])('rejects %o', async (body, status, code) => {
    const res = await createRequest(caleb, body);
    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it('cannot ask a business to pay', async () => {
    await prisma.user.update({ where: { id: john.userId }, data: { role: 'BUSINESS' } });
    const res = await createRequest(caleb, { payer: 'john254', amount: '10' });
    expect(res.body.error.code).toBe(ERROR_CODES.RECIPIENT_UNAVAILABLE);
  });
});

describe('listing', () => {
  it('separates incoming and outgoing and filters by status', async () => {
    const id = await newRequest();
    await createRequest(john, { payer: 'caleb254', amount: '50' });

    const incoming = await request(app)
      .get('/api/payment-requests?direction=incoming')
      .set(auth(john));
    expect(incoming.body.data.items.map((r: { id: string }) => r.id)).toEqual([id]);
    expect(incoming.body.data.items[0]).toMatchObject({
      direction: 'incoming',
      counterparty: { username: 'caleb254' },
    });

    const outgoing = await request(app)
      .get('/api/payment-requests?direction=outgoing')
      .set(auth(john));
    expect(outgoing.body.data.items).toHaveLength(1);

    await decline(john, id);
    const pending = await request(app)
      .get('/api/payment-requests?direction=incoming&status=PENDING')
      .set(auth(john));
    expect(pending.body.data.items).toHaveLength(0);
  });

  it('summarises pending requests', async () => {
    await newRequest('2000');
    await newRequest('500');
    const res = await request(app).get('/api/payment-requests/summary').set(auth(john));
    expect(res.body.data).toEqual({
      incomingPending: 2,
      incomingPendingAmount: '2500.00',
      outgoingPending: 0,
      outgoingPendingAmount: '0.00',
    });
  });

  it('hides requests from anyone who is not a party (404)', async () => {
    const id = await newRequest();
    const outsider = await registerUser(app);
    expect((await request(app).get(`/api/payment-requests/${id}`).set(auth(outsider))).status).toBe(
      404,
    );
    expect((await pay(outsider, id)).status).toBe(404);
  });
});

describe('POST /api/payment-requests/:id/pay', () => {
  it('pays the request: money moves, statuses update, both sides are told', async () => {
    const id = await newRequest();
    const res = await pay(john, id);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      balance: '8000.00',
      request: { status: 'PAID', transactionReference: expect.stringMatching(/^TXN-/) },
      transaction: {
        type: 'REQUEST_PAYMENT',
        amount: '2000.00',
        recipient: { username: 'caleb254' },
      },
    });
    expect(await balanceOf(caleb.userId)).toBe('2000.00');
    expect(await balanceOf(john.userId)).toBe('8000.00');

    const paidNote = await prisma.notification.findFirstOrThrow({
      where: { userId: caleb.userId, type: 'REQUEST_PAID' },
    });
    expect(paidNote.body).toBe('@john254 paid your request of KSh 2,000.00.');
    expect((await reconcileLedger()).healthy).toBe(true);
  });

  it('only the payer can pay', async () => {
    const id = await newRequest();
    await fundUser(caleb.userId, '5000.00');
    expect((await pay(caleb, id)).status).toBe(404);
  });

  it('cannot be paid twice, even with a different idempotency key', async () => {
    const id = await newRequest();
    expect((await pay(john, id)).status).toBe(201);
    const again = await pay(john, id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe(ERROR_CODES.REQUEST_NOT_PENDING);
    expect(await balanceOf(john.userId)).toBe('8000.00');
  });

  it('replays with the same idempotency key', async () => {
    const id = await newRequest();
    const key = `k-${randomUUID()}`;
    const first = await pay(john, id, TEST_PIN, key);
    const second = await pay(john, id, TEST_PIN, key);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body).toEqual(first.body);
  });

  it('pays exactly once under concurrent attempts with different keys', async () => {
    const id = await newRequest();
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(john, id)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.transaction.count({ where: { paymentRequestId: id } })).toBe(1);
    expect(await balanceOf(john.userId)).toBe('8000.00');
  });

  it('lets exactly one of a concurrent pay and decline win', async () => {
    const id = await newRequest();
    const [paid, declined] = await Promise.all([pay(john, id), decline(john, id)]);
    const winners = [paid.status, declined.status].filter((status) => status < 300);
    expect(winners).toHaveLength(1);

    const final = await prisma.paymentRequest.findUniqueOrThrow({ where: { id } });
    const moved = (await prisma.transaction.count({ where: { paymentRequestId: id } })) === 1;
    expect(final.status === 'PAID').toBe(moved);
  });

  it('keeps the request pending after a wrong PIN or insufficient funds', async () => {
    const id = await newRequest('20000');
    expect((await pay(john, id, '9999')).body.error.code).toBe(ERROR_CODES.INVALID_PIN);
    expect((await pay(john, id)).body.error.code).toBe(ERROR_CODES.INSUFFICIENT_BALANCE);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
      'PENDING',
    );
  });

  it('refuses expired requests', async () => {
    const id = await newRequest();
    await prisma.paymentRequest.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await pay(john, id);
    expect(res.status).toBe(410);
    expect(res.body.error.code).toBe(ERROR_CODES.REQUEST_EXPIRED);
  });

  it('requires an idempotency key', async () => {
    const id = await newRequest();
    const res = await request(app)
      .post(`/api/payment-requests/${id}/pay`)
      .set(auth(john))
      .send({ pin: TEST_PIN });
    expect(res.body.error.code).toBe(ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED);
  });
});

describe('decline & cancel', () => {
  it('the payer declines and the requester is told', async () => {
    const id = await newRequest();
    const res = await decline(john, id);
    expect(res.body.data.status).toBe('DECLINED');
    const note = await prisma.notification.findFirstOrThrow({
      where: { userId: caleb.userId, type: 'REQUEST_DECLINED' },
    });
    expect(note.body).toBe('@john254 declined your request of KSh 2,000.00.');
    expect((await pay(john, id)).body.error.code).toBe(ERROR_CODES.REQUEST_NOT_PENDING);
  });

  it('the requester cancels; the payer cannot cancel and the requester cannot decline', async () => {
    const id = await newRequest();
    expect((await cancel(john, id)).status).toBe(404);
    expect((await decline(caleb, id)).status).toBe(404);
    const res = await cancel(caleb, id);
    expect(res.body.data.status).toBe('CANCELLED');
    expect(
      await prisma.notification.count({
        where: { userId: john.userId, type: 'REQUEST_CANCELLED' },
      }),
    ).toBe(1);
  });
});

describe('expiry', () => {
  it('reports overdue requests as EXPIRED and the sweeper persists it once', async () => {
    const id = await newRequest();
    await prisma.paymentRequest.update({
      where: { id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const view = await request(app).get(`/api/payment-requests/${id}`).set(auth(john));
    expect(view.body.data.status).toBe('EXPIRED');

    expect(await expireOverdueRequests()).toBe(1);
    expect(await expireOverdueRequests()).toBe(0);
    expect((await prisma.paymentRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
      'EXPIRED',
    );
    const note = await prisma.notification.findFirstOrThrow({
      where: { userId: caleb.userId, type: 'REQUEST_EXPIRED' },
    });
    expect(note.body).toBe('Your request to @john254 for KSh 2,000.00 expired.');
  });
});
