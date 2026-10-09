import { ERROR_CODES } from '@app/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { postTransfer } from '../../src/services/ledger.service.js';
import { reconcileLedger } from '../../src/services/reconciliation.service.js';
import { AppError } from '../../src/utils/AppError.js';
import { money } from '../../src/utils/money.js';
import { runInTransaction } from '../../src/utils/transaction.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { createUserWithWallet } from '../helpers/factories.js';
import { balanceOf, fundUser } from '../helpers/money.js';

async function transfer(fromUserId: string, toUserId: string, amount: string) {
  const [from, to] = await Promise.all([
    prisma.wallet.findUniqueOrThrow({ where: { userId: fromUserId } }),
    prisma.wallet.findUniqueOrThrow({ where: { userId: toUserId } }),
  ]);
  return runInTransaction((tx) =>
    postTransfer(tx, {
      type: 'TRANSFER',
      fromWalletId: from.id,
      toWalletId: to.id,
      amount: money(amount),
      initiatorId: fromUserId,
      note: 'Lunch 😂',
    }),
  );
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy(
    (err: unknown) => err instanceof AppError && err.code === code,
  );
}

beforeEach(resetDatabase);

describe('postTransfer', () => {
  it('moves money and writes one balanced debit/credit pair', async () => {
    const caleb = await createUserWithWallet({ username: 'caleb254' });
    const john = await createUserWithWallet({ username: 'john254' });
    await fundUser(caleb.id, '25000.00');

    const posted = await transfer(caleb.id, john.id, '1500.00');

    expect(posted.reference).toMatch(/^TXN-[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(await balanceOf(caleb.id)).toBe('23500.00');
    expect(await balanceOf(john.id)).toBe('1500.00');

    const txn = await prisma.transaction.findUniqueOrThrow({
      where: { id: posted.id },
      include: { ledgerEntries: true },
    });
    expect(txn).toMatchObject({
      status: 'COMPLETED',
      type: 'TRANSFER',
      note: 'Lunch 😂',
      visibility: 'PRIVATE',
    });
    expect(txn.completedAt).not.toBeNull();
    const debit = txn.ledgerEntries.find((e) => e.direction === 'DEBIT')!;
    const credit = txn.ledgerEntries.find((e) => e.direction === 'CREDIT')!;
    expect(debit.walletId).toBe(caleb.wallet!.id);
    expect(debit.balanceAfter.toFixed(2)).toBe('23500.00');
    expect(credit.walletId).toBe(john.wallet!.id);
    expect(credit.balanceAfter.toFixed(2)).toBe('1500.00');
  });

  it('rejects insufficient balance and changes nothing', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await fundUser(a.id, '100.00');

    await expectCode(transfer(a.id, b.id, '100.01'), ERROR_CODES.INSUFFICIENT_BALANCE);
    expect(await balanceOf(a.id)).toBe('100.00');
    expect(await balanceOf(b.id)).toBe('0.00');
    expect(await prisma.transaction.count({ where: { type: 'TRANSFER' } })).toBe(0);
  });

  it('allows spending the exact balance down to zero', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await fundUser(a.id, '100.00');
    await transfer(a.id, b.id, '100.00');
    expect(await balanceOf(a.id)).toBe('0.00');
  });

  it.each([
    ['zero', '0'],
    ['negative', '-5'],
    ['sub-cent', '1.005'],
  ])('rejects a %s amount', async (_label, amount) => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await fundUser(a.id, '100.00');
    await expectCode(transfer(a.id, b.id, amount), ERROR_CODES.AMOUNT_OUT_OF_RANGE);
  });

  it('rejects sending to the same wallet', async () => {
    const a = await createUserWithWallet();
    await fundUser(a.id, '100.00');
    await expectCode(transfer(a.id, a.id, '10.00'), ERROR_CODES.SELF_TRANSFER);
  });

  it('blocks a suspended sender, a suspended recipient and frozen wallets', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await fundUser(a.id, '100.00');

    await prisma.user.update({ where: { id: b.id }, data: { status: 'SUSPENDED' } });
    await expectCode(transfer(a.id, b.id, '10.00'), ERROR_CODES.RECIPIENT_UNAVAILABLE);
    await prisma.user.update({ where: { id: b.id }, data: { status: 'ACTIVE' } });

    await prisma.wallet.update({ where: { userId: b.id }, data: { status: 'FROZEN' } });
    await expectCode(transfer(a.id, b.id, '10.00'), ERROR_CODES.RECIPIENT_UNAVAILABLE);
    await prisma.wallet.update({ where: { userId: b.id }, data: { status: 'ACTIVE' } });

    await prisma.wallet.update({ where: { userId: a.id }, data: { status: 'FROZEN' } });
    await expectCode(transfer(a.id, b.id, '10.00'), ERROR_CODES.WALLET_FROZEN);
    await prisma.wallet.update({ where: { userId: a.id }, data: { status: 'ACTIVE' } });

    await prisma.user.update({ where: { id: a.id }, data: { status: 'SUSPENDED' } });
    await expectCode(transfer(a.id, b.id, '10.00'), ERROR_CODES.ACCOUNT_SUSPENDED);
    expect(await balanceOf(a.id)).toBe('100.00');
  });
});

describe('concurrency', () => {
  it('never overspends under parallel transfers from one wallet', async () => {
    const sender = await createUserWithWallet();
    const receivers = await Promise.all(Array.from({ length: 4 }, () => createUserWithWallet()));
    await fundUser(sender.id, '1000.00');

    // 20 parallel transfers of 100 against a balance of 1000: exactly 10 may succeed.
    const results = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => transfer(sender.id, receivers[i % 4]!.id, '100.00')),
    );
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(succeeded).toBe(10);
    expect(rejected).toHaveLength(10);
    for (const r of rejected)
      expect((r.reason as AppError).code).toBe(ERROR_CODES.INSUFFICIENT_BALANCE);
    expect(await balanceOf(sender.id)).toBe('0.00');
    expect((await reconcileLedger()).healthy).toBe(true);
  });

  it('handles opposite-direction transfers without deadlocking', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await fundUser(a.id, '500.00');
    await fundUser(b.id, '500.00');

    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, i) =>
        i % 2 === 0 ? transfer(a.id, b.id, '10.00') : transfer(b.id, a.id, '10.00'),
      ),
    );

    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(await balanceOf(a.id)).toBe('500.00');
    expect(await balanceOf(b.id)).toBe('500.00');
    expect((await reconcileLedger()).healthy).toBe(true);
  });
});

describe('funding', () => {
  it('credits from the treasury via the demo provider and notifies the user', async () => {
    const user = await createUserWithWallet();
    const posted = await fundUser(user.id, '7500.00');

    const txn = await prisma.transaction.findUniqueOrThrow({ where: { id: posted.id } });
    expect(txn).toMatchObject({ type: 'FUNDING', provider: 'demo' });
    expect(txn.providerRef).toMatch(/^DEMO-/);
    expect(txn.metadata).toEqual({ simulated: true });

    const treasury = await prisma.wallet.findFirstOrThrow({ where: { type: 'TREASURY' } });
    expect(treasury.balance.toFixed(2)).toBe('-7500.00');

    const notification = await prisma.notification.findFirstOrThrow({ where: { userId: user.id } });
    expect(notification.body).toBe(
      'Your wallet was credited with KSh 7,500.00 in simulated demo funds.',
    );
    expect(
      await prisma.auditLog.count({ where: { action: 'WALLET_FUNDED', entityId: posted.id } }),
    ).toBe(1);
  });
});

describe('reconcileLedger', () => {
  it('reports a healthy ledger that sums to zero', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await fundUser(a.id, '300.00');
    await transfer(a.id, b.id, '120.50');

    const report = await reconcileLedger();
    expect(report).toMatchObject({
      healthy: true,
      totalBalance: '0.00',
      mismatchedWallets: [],
      unbalancedTransactions: [],
    });
  });

  it('detects a balance that was changed behind the ledger’s back', async () => {
    const a = await createUserWithWallet();
    await fundUser(a.id, '300.00');

    // Simulate a privileged manual edit with the protective triggers switched off.
    await prisma.$transaction([
      prisma.$executeRaw`ALTER TABLE wallets DISABLE TRIGGER USER`,
      prisma.$executeRaw`UPDATE wallets SET balance = 999999 WHERE user_id = ${a.id}::uuid`,
      prisma.$executeRaw`ALTER TABLE wallets ENABLE TRIGGER USER`,
    ]);

    const report = await reconcileLedger();
    expect(report.healthy).toBe(false);
    expect(report.mismatchedWallets).toEqual([
      { walletId: a.wallet!.id, balance: '999999.00', ledgerBalance: '300.00' },
    ]);
  });
});
