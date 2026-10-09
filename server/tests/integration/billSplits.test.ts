import { randomUUID } from 'node:crypto';
import { ERROR_CODES } from '@app/shared';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app.js';
import { reconcileLedger } from '../../src/services/reconciliation.service.js';
import { registerUser, TEST_PIN, type RegisteredUser } from '../helpers/auth.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { balanceOf, fundUser } from '../helpers/money.js';

const app = createApp();
const auth = (user: RegisteredUser) => ({ Authorization: `Bearer ${user.accessToken}` });
const createSplit = (user: RegisteredUser, body: Record<string, unknown>) =>
  request(app).post('/api/bill-splits').set(auth(user)).send(body);

let caleb: RegisteredUser;
let friends: RegisteredUser[];

beforeEach(async () => {
  await resetDatabase();
  caleb = await registerUser(app, { username: 'caleb254', fullName: 'Caleb Chimera' });
  friends = [];
  for (const name of ['john254', 'brian254', 'mike254', 'david254']) {
    const friend = await registerUser(app, { username: name });
    await fundUser(friend.userId, '5000.00');
    friends.push(friend);
  }
});

const restaurantBill = {
  title: 'Dinner at Carnivore',
  totalAmount: '6000',
  participants: [
    { username: 'john254' },
    { username: '@brian254' },
    { username: 'mike254' },
    { username: 'david254' },
  ],
};

async function payShare(friend: RegisteredUser) {
  const list = await request(app)
    .get('/api/payment-requests?direction=incoming&status=PENDING')
    .set(auth(friend));
  const id = list.body.data.items[0].id;
  return request(app)
    .post(`/api/payment-requests/${id}/pay`)
    .set(auth(friend))
    .set('Idempotency-Key', `k-${randomUUID()}`)
    .send({ pin: TEST_PIN });
}

describe('POST /api/bill-splits', () => {
  it('splits KSh 6,000 five ways: KSh 1,200 each, creator’s share settled', async () => {
    const res = await createSplit(caleb, restaurantBill);

    expect(res.status).toBe(201);
    const split = res.body.data;
    expect(split).toMatchObject({
      title: 'Dinner at Carnivore',
      totalAmount: '6000.00',
      method: 'EQUAL',
      status: 'OPEN',
      isCreator: true,
      amountPaid: '1200.00',
      amountRemaining: '4800.00',
    });
    expect(split.participants).toHaveLength(5);
    for (const p of split.participants) expect(p.amountOwed).toBe('1200.00');
    expect(split.participants.find((p: { isCreator: boolean }) => p.isCreator).status).toBe(
      'SETTLED_SELF',
    );

    const requests = await prisma.paymentRequest.findMany({ where: { requesterId: caleb.userId } });
    expect(requests).toHaveLength(4);
    expect(
      requests.every((r) => r.amount.toFixed(2) === '1200.00' && r.note === 'Dinner at Carnivore'),
    ).toBe(true);

    const note = await prisma.notification.findFirstOrThrow({
      where: { userId: friends[0]!.userId, type: 'SPLIT_CREATED' },
    });
    expect(note.body).toBe('@caleb254 split “Dinner at Carnivore” — your share is KSh 1,200.00.');
  });

  it('rounds unequal splits deterministically, extra cent to the creator', async () => {
    const res = await createSplit(caleb, {
      title: 'Groceries',
      totalAmount: '1000',
      participants: [{ username: 'john254' }, { username: 'brian254' }],
    });
    const owed = res.body.data.participants.map((p: { isCreator: boolean; amountOwed: string }) => [
      p.isCreator,
      p.amountOwed,
    ]);
    expect(owed).toEqual([
      [true, '333.34'],
      [false, '333.33'],
      [false, '333.33'],
    ]);
  });

  it('supports custom shares; the creator covers the rest', async () => {
    const res = await createSplit(caleb, {
      title: 'Matatu + snacks',
      totalAmount: '1000',
      method: 'CUSTOM',
      participants: [
        { username: 'john254', amount: '300' },
        { username: 'brian254', amount: '450.50' },
      ],
    });
    expect(res.status).toBe(201);
    const creator = res.body.data.participants.find((p: { isCreator: boolean }) => p.isCreator);
    expect(creator.amountOwed).toBe('249.50');
  });

  it('can exclude the creator', async () => {
    const res = await createSplit(caleb, { ...restaurantBill, includeSelf: false });
    expect(res.body.data.participants).toHaveLength(4);
    expect(
      res.body.data.participants.every((p: { amountOwed: string }) => p.amountOwed === '1500.00'),
    ).toBe(true);
  });

  it.each([
    [
      'custom shares above the total',
      {
        method: 'CUSTOM',
        totalAmount: '100',
        participants: [{ username: 'john254', amount: '150' }],
      },
      ERROR_CODES.VALIDATION_ERROR,
      'more than the total',
    ],
    [
      'custom shares that do not add up when the creator is excluded',
      {
        method: 'CUSTOM',
        totalAmount: '100',
        includeSelf: false,
        participants: [{ username: 'john254', amount: '60' }],
      },
      ERROR_CODES.VALIDATION_ERROR,
      'must add up to exactly KSh 100.00',
    ],
    [
      'a missing custom amount',
      { method: 'CUSTOM', totalAmount: '100', participants: [{ username: 'john254' }] },
      ERROR_CODES.VALIDATION_ERROR,
      'Enter this person',
    ],
    [
      'duplicate people',
      { totalAmount: '100', participants: [{ username: 'john254' }, { username: 'JOHN254' }] },
      ERROR_CODES.VALIDATION_ERROR,
      'only be added once',
    ],
    [
      'the creator in the list',
      { totalAmount: '100', participants: [{ username: 'caleb254' }] },
      ERROR_CODES.VALIDATION_ERROR,
      'included automatically',
    ],
    [
      'an unknown person',
      { totalAmount: '100', participants: [{ username: 'ghost_user' }] },
      ERROR_CODES.VALIDATION_ERROR,
      "couldn't find @ghost_user",
    ],
    [
      'shares below KSh 1',
      { totalAmount: '1.50', participants: [{ username: 'john254' }, { username: 'brian254' }] },
      ERROR_CODES.AMOUNT_OUT_OF_RANGE,
      'share must be between',
    ],
  ])('rejects %s', async (_label, body, code, reason) => {
    const res = await createSplit(caleb, { title: 'Team lunch', ...body });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error.code).toBe(code);
    // Assert the specific reason, so a case can't pass because of an unrelated error.
    const messages = [
      res.body.error.message,
      ...(res.body.error.details ?? []).map((d: { message: string }) => d.message),
    ];
    expect(messages.join(' | ')).toContain(reason);
    expect(await prisma.billSplit.count()).toBe(0);
  });
});

describe('settling a split', () => {
  it('tracks paid and remaining amounts and settles when everyone has paid', async () => {
    const created = await createSplit(caleb, restaurantBill);
    const id = created.body.data.id;

    const first = await payShare(friends[0]!);
    expect(first.body.data.transaction.type).toBe('SPLIT_PAYMENT');

    let view = await request(app).get(`/api/bill-splits/${id}`).set(auth(caleb));
    expect(view.body.data).toMatchObject({
      status: 'OPEN',
      amountPaid: '2400.00',
      amountRemaining: '3600.00',
    });

    for (const friend of friends.slice(1)) expect((await payShare(friend)).status).toBe(201);

    view = await request(app).get(`/api/bill-splits/${id}`).set(auth(caleb));
    expect(view.body.data).toMatchObject({
      status: 'SETTLED',
      amountPaid: '6000.00',
      amountRemaining: '0.00',
    });
    expect(await balanceOf(caleb.userId)).toBe('4800.00');
    expect(await prisma.transaction.count({ where: { billSplitId: id } })).toBe(4);
    expect((await reconcileLedger()).healthy).toBe(true);
  });

  it('a declined share keeps the split open and is shown as declined', async () => {
    const created = await createSplit(caleb, restaurantBill);
    const requestId = (
      await prisma.paymentRequest.findFirstOrThrow({ where: { payerId: friends[0]!.userId } })
    ).id;
    await request(app)
      .post(`/api/payment-requests/${requestId}/decline`)
      .set(auth(friends[0]!))
      .send();

    const view = await request(app)
      .get(`/api/bill-splits/${created.body.data.id}`)
      .set(auth(caleb));
    expect(view.body.data.status).toBe('OPEN');
    expect(
      view.body.data.participants.filter((p: { status: string }) => p.status === 'DECLINED'),
    ).toHaveLength(1);
  });

  it('cancelling cancels unpaid shares but keeps paid ones', async () => {
    const created = await createSplit(caleb, restaurantBill);
    const id = created.body.data.id;
    await payShare(friends[0]!);

    const res = await request(app).post(`/api/bill-splits/${id}/cancel`).set(auth(caleb)).send();
    expect(res.body.data.status).toBe('CANCELLED');
    const statuses = res.body.data.participants.map((p: { status: string }) => p.status).sort();
    expect(statuses).toEqual(['CANCELLED', 'CANCELLED', 'CANCELLED', 'PAID', 'SETTLED_SELF']);
    expect(await prisma.paymentRequest.count({ where: { status: 'PENDING' } })).toBe(0);

    const again = await request(app).post(`/api/bill-splits/${id}/cancel`).set(auth(caleb)).send();
    expect(again.status).toBe(409);
  });

  it('only the creator can cancel', async () => {
    const created = await createSplit(caleb, restaurantBill);
    const res = await request(app)
      .post(`/api/bill-splits/${created.body.data.id}/cancel`)
      .set(auth(friends[0]!))
      .send();
    expect(res.status).toBe(404);
  });
});

describe('visibility', () => {
  it('participants see the split; outsiders get 404', async () => {
    const created = await createSplit(caleb, restaurantBill);
    const id = created.body.data.id;
    const outsider = await registerUser(app);

    const asParticipant = await request(app).get(`/api/bill-splits/${id}`).set(auth(friends[1]!));
    expect(asParticipant.body.data.isCreator).toBe(false);
    expect((await request(app).get(`/api/bill-splits/${id}`).set(auth(outsider))).status).toBe(404);

    const list = await request(app).get('/api/bill-splits').set(auth(friends[1]!));
    expect(list.body.data).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toMatch(/@example\.test|\+254/);
  });
});
