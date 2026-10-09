import { beforeEach, describe, expect, it } from 'vitest';
import { Prisma } from '../../src/config/database.js';
import { walletRepository } from '../../src/repositories/wallet.repository.js';
import { generateTransactionReference } from '../../src/utils/reference.js';
import { prisma, resetDatabase } from '../helpers/db.js';
import { createUserWithoutWallet, createUserWithWallet } from '../helpers/factories.js';

const D = (value: string) => new Prisma.Decimal(value);

/**
 * Minimal, correct double-entry posting used to exercise the DB rules.
 * (The real ledger service arrives in Phase 4.)
 */
async function postTransfer(fromWalletId: string, toWalletId: string, amount: string) {
  return prisma.$transaction(async (tx) => {
    const from = await tx.wallet.update({
      where: { id: fromWalletId },
      data: { balance: { decrement: D(amount) } },
    });
    const to = await tx.wallet.update({
      where: { id: toWalletId },
      data: { balance: { increment: D(amount) } },
    });
    const initiator = await tx.user.findFirstOrThrow({ where: { role: 'SYSTEM' } });
    return tx.transaction.create({
      data: {
        reference: generateTransactionReference(),
        type: 'FUNDING',
        amount: D(amount),
        fromWalletId,
        toWalletId,
        initiatorId: initiator.id,
        completedAt: new Date(),
        ledgerEntries: {
          create: [
            {
              walletId: fromWalletId,
              direction: 'DEBIT',
              amount: D(amount),
              balanceAfter: from.balance,
            },
            {
              walletId: toWalletId,
              direction: 'CREDIT',
              amount: D(amount),
              balanceAfter: to.balance,
            },
          ],
        },
      },
    });
  });
}

async function treasuryId(): Promise<string> {
  return (await walletRepository.findTreasury(prisma))!.id;
}

beforeEach(resetDatabase);

describe('schema bootstrap', () => {
  it('has exactly one treasury wallet owned by the SYSTEM account', async () => {
    const treasuries = await prisma.wallet.findMany({
      where: { type: 'TREASURY' },
      include: { user: true },
    });
    expect(treasuries).toHaveLength(1);
    expect(treasuries[0]!.user.role).toBe('SYSTEM');
    expect(treasuries[0]!.user.passwordHash).toBeNull();
  });

  it('rejects a second treasury wallet', async () => {
    const user = await createUserWithoutWallet();
    await expect(
      prisma.wallet.create({ data: { userId: user.id, type: 'TREASURY' } }),
    ).rejects.toThrow(/Unique constraint|wallets_single_treasury/);
  });

  it('rejects changing a wallet owner or type, and deleting wallets', async () => {
    const user = await createUserWithWallet();
    await expect(
      prisma.wallet.update({ where: { id: user.wallet!.id }, data: { type: 'TREASURY' } }),
    ).rejects.toThrow(/IMMUTABLE/);
    await expect(prisma.wallet.delete({ where: { id: user.wallet!.id } })).rejects.toThrow(
      /APPEND_ONLY/,
    );
  });
});

describe('money columns', () => {
  it('stores amounts as exact decimals with two places', async () => {
    const user = await createUserWithWallet();
    await postTransfer(await treasuryId(), user.wallet!.id, '0.10');
    await postTransfer(await treasuryId(), user.wallet!.id, '0.20');

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: user.wallet!.id } });
    expect(wallet.balance.toFixed(2)).toBe('0.30'); // 0.1 + 0.2 !== 0.3 in floating point
  });

  it('keeps the whole ledger summing to zero', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await postTransfer(await treasuryId(), a.wallet!.id, '25000.00');
    await postTransfer(a.wallet!.id, b.wallet!.id, '1500.00');

    const [row] = await prisma.$queryRaw<{ total: Prisma.Decimal }[]>`
      SELECT SUM(balance) AS total FROM wallets`;
    expect(new Prisma.Decimal(row!.total).isZero()).toBe(true);
  });
});

describe('balance rules', () => {
  it('rejects a negative balance on a personal wallet', async () => {
    const a = await createUserWithWallet();
    const b = await createUserWithWallet();
    await expect(postTransfer(a.wallet!.id, b.wallet!.id, '1.00')).rejects.toThrow(
      /wallets_balance_non_negative/,
    );
  });

  it('allows the treasury to go negative (it issues simulated money)', async () => {
    const user = await createUserWithWallet();
    await postTransfer(await treasuryId(), user.wallet!.id, '100.00');
    const treasury = await prisma.wallet.findUniqueOrThrow({ where: { id: await treasuryId() } });
    expect(treasury.balance.toFixed(2)).toBe('-100.00');
  });

  it('rejects changing a balance without matching ledger entries', async () => {
    const user = await createUserWithWallet();
    await expect(
      prisma.wallet.update({ where: { id: user.wallet!.id }, data: { balance: D('500.00') } }),
    ).rejects.toThrow(/LEDGER_MISMATCH/);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { id: user.wallet!.id } });
    expect(wallet.balance.toFixed(2)).toBe('0.00');
  });

  it('rejects creating a wallet with an opening balance', async () => {
    const user = await createUserWithoutWallet();
    await expect(
      prisma.wallet.create({ data: { userId: user.id, balance: D('1000.00') } }),
    ).rejects.toThrow(/LEDGER_MISMATCH/);
  });
});

describe('ledger immutability', () => {
  it('rejects UPDATE and DELETE on ledger entries', async () => {
    const user = await createUserWithWallet();
    const txn = await postTransfer(await treasuryId(), user.wallet!.id, '50.00');

    await expect(
      prisma.ledgerEntry.updateMany({
        where: { transactionId: txn.id },
        data: { amount: D('1.00') },
      }),
    ).rejects.toThrow(/APPEND_ONLY/);
    await expect(
      prisma.ledgerEntry.deleteMany({ where: { transactionId: txn.id } }),
    ).rejects.toThrow(/APPEND_ONLY/);
  });

  it('rejects changing financial fields of a transaction', async () => {
    const user = await createUserWithWallet();
    const txn = await postTransfer(await treasuryId(), user.wallet!.id, '50.00');

    await expect(
      prisma.transaction.update({ where: { id: txn.id }, data: { amount: D('5000.00') } }),
    ).rejects.toThrow(/IMMUTABLE/);
    await expect(prisma.transaction.delete({ where: { id: txn.id } })).rejects.toThrow(
      /APPEND_ONLY/,
    );
  });

  it('only lets transaction status move forward', async () => {
    const user = await createUserWithWallet();
    const txn = await postTransfer(await treasuryId(), user.wallet!.id, '50.00');

    await expect(
      prisma.transaction.update({ where: { id: txn.id }, data: { status: 'PENDING' } }),
    ).rejects.toThrow(/INVALID_STATUS/);
    await expect(
      prisma.transaction.update({ where: { id: txn.id }, data: { status: 'REVERSED' } }),
    ).resolves.toMatchObject({ status: 'REVERSED' });
  });

  it('rejects a completed transaction without balanced ledger entries', async () => {
    const user = await createUserWithWallet();
    const system = await prisma.user.findFirstOrThrow({ where: { role: 'SYSTEM' } });
    await expect(
      prisma.transaction.create({
        data: {
          reference: generateTransactionReference(),
          type: 'FUNDING',
          amount: D('10.00'),
          fromWalletId: await treasuryId(),
          toWalletId: user.wallet!.id,
          initiatorId: system.id,
          completedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/UNBALANCED_TRANSACTION/);
  });

  it('rejects audit log modification', async () => {
    const log = await prisma.auditLog.create({
      data: { action: 'TEST_EVENT', entityType: 'system' },
    });
    await expect(
      prisma.auditLog.update({ where: { id: log.id }, data: { action: 'TAMPERED' } }),
    ).rejects.toThrow(/APPEND_ONLY/);
  });
});

describe('field constraints', () => {
  it('enforces username, email and phone formats', async () => {
    const base = {
      fullName: 'Format Test',
      passwordHash: 'x',
      pinHash: 'x',
      phone: '+254700000001',
      email: 'format@example.test',
      username: 'format_test',
    };
    await expect(prisma.user.create({ data: { ...base, username: 'Has-Caps' } })).rejects.toThrow(
      /users_username_format/,
    );
    await expect(
      prisma.user.create({ data: { ...base, email: 'Mixed@Example.test' } }),
    ).rejects.toThrow(/users_email_lowercase/);
    await expect(prisma.user.create({ data: { ...base, phone: '0712345678' } })).rejects.toThrow(
      /users_phone_kenyan_e164/,
    );
    await expect(prisma.user.create({ data: base })).resolves.toMatchObject({
      username: 'format_test',
    });
  });

  it('requires a PIN for accounts that can move money', async () => {
    await expect(
      prisma.user.create({
        data: {
          fullName: 'No Pin',
          username: 'no_pin',
          email: 'nopin@example.test',
          phone: '+254700000002',
          passwordHash: 'x',
        },
      }),
    ).rejects.toThrow(/users_credentials_by_role/);
  });

  it('rejects self-requests and non-positive amounts', async () => {
    const user = await createUserWithWallet();
    const other = await createUserWithWallet();
    const expiresAt = new Date(Date.now() + 86_400_000);

    await expect(
      prisma.paymentRequest.create({
        data: { requesterId: user.id, payerId: user.id, amount: D('10.00'), expiresAt },
      }),
    ).rejects.toThrow(/payment_requests_not_self/);
    await expect(
      prisma.paymentRequest.create({
        data: { requesterId: user.id, payerId: other.id, amount: D('0.00'), expiresAt },
      }),
    ).rejects.toThrow(/payment_requests_amount_positive/);
  });

  it('allows only one active static QR code per user', async () => {
    const user = await createUserWithWallet();
    await prisma.qrCode.create({ data: { userId: user.id, code: 'A'.repeat(24) } });
    await expect(
      prisma.qrCode.create({ data: { userId: user.id, code: 'B'.repeat(24) } }),
    ).rejects.toThrow();
    await expect(
      prisma.qrCode.create({
        data: { userId: user.id, code: 'C'.repeat(24), type: 'DYNAMIC', amount: D('250.00') },
      }),
    ).resolves.toMatchObject({ type: 'DYNAMIC' });
  });
});
