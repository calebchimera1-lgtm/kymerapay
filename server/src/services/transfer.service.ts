import {
  ERROR_CODES,
  formatMoney,
  type CreateTransferData,
  type PublicProfile,
  type TransferResult,
} from '@app/shared';
import { prisma } from '../config/database.js';
import { toCounterparty } from '../mappers/wallet.mapper.js';
import { publicProfileSelect, toPublicProfile } from '../mappers/profile.mapper.js';
import {
  idempotencyRepository,
  type IdempotencyReservation,
} from '../repositories/idempotency.repository.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString } from '../utils/money.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { postTransfer } from './ledger.service.js';
import { assertAmountWithinLimits, assertWithinDailyLimit } from './limits.service.js';
import { createNotification } from './notification.service.js';
import { verifyPin } from './pin.service.js';
import { qrService } from './qr.service.js';

async function findRecipient(username: string, senderId: string) {
  const recipient = await prisma.user.findUnique({
    where: { username },
    select: { ...publicProfileSelect, status: true, wallet: { select: { id: true } } },
  });
  if (
    !recipient ||
    !recipient.wallet ||
    (recipient.role !== 'USER' && recipient.role !== 'BUSINESS')
  ) {
    throw new AppError(ERROR_CODES.RECIPIENT_NOT_FOUND, `We couldn't find @${username}.`, 404);
  }
  if (recipient.id === senderId) {
    throw new AppError(ERROR_CODES.SELF_TRANSFER, 'You cannot send money to yourself.', 422);
  }
  if (recipient.status !== 'ACTIVE') {
    throw new AppError(
      ERROR_CODES.RECIPIENT_UNAVAILABLE,
      'This recipient cannot receive payments right now.',
      422,
    );
  }
  return { ...recipient, walletId: recipient.wallet.id };
}

/**
 * Sends simulated money from one account to another.
 *
 * Order matters: cheap validation → recipient → PIN (outside the DB
 * transaction, so failed attempts are counted even though nothing moves) →
 * one database transaction that posts the ledger entries, enforces the daily
 * limit under lock, notifies both parties, audits, and completes the
 * idempotency record. Either all of that commits, or none of it does.
 */
export async function sendMoney(
  senderId: string,
  input: CreateTransferData,
  context: RequestContext,
  reservation?: IdempotencyReservation,
): Promise<TransferResult> {
  const amount = money(input.amount);
  assertAmountWithinLimits(amount);

  const sender = await prisma.user.findUniqueOrThrow({
    where: { id: senderId },
    select: { username: true, defaultVisibility: true, wallet: { select: { id: true } } },
  });
  if (!sender.wallet) throw AppError.forbidden('This account cannot send money.');
  const recipient = await findRecipient(input.recipient, senderId);

  if (input.qrCode) {
    // Early check so a stale or mismatched QR fails before the PIN step.
    await qrService.validateForPayment(prisma, input.qrCode, recipient.id, amount);
  }

  await verifyPin(senderId, input.pin, context);

  const isBusiness = recipient.role === 'BUSINESS';
  // Payments to businesses never appear in social feeds.
  const visibility = isBusiness ? 'PRIVATE' : (input.visibility ?? sender.defaultVisibility);
  const amountText = formatMoney(toAmountString(amount));

  return runInTransaction(async (tx) => {
    // Authoritative check under lock; a fixed-amount QR is consumed here (single use).
    const qrCodeId = input.qrCode
      ? await qrService.validateForPayment(tx, input.qrCode, recipient.id, amount, { lock: true })
      : undefined;

    const posted = await postTransfer(tx, {
      type: isBusiness ? 'BUSINESS_PAYMENT' : 'TRANSFER',
      fromWalletId: sender.wallet!.id,
      toWalletId: recipient.walletId,
      amount,
      initiatorId: senderId,
      note: input.note ?? null,
      visibility,
      ...(qrCodeId ? { qrCodeId } : {}),
      afterLock: () => assertWithinDailyLimit(tx, sender.wallet!.id, amount),
    });

    await createNotification(tx, {
      userId: recipient.id,
      type: 'MONEY_RECEIVED',
      title: 'Money received',
      body: `You received ${amountText} from @${sender.username}.`,
      data: { reference: posted.reference },
    });
    await createNotification(tx, {
      userId: senderId,
      type: 'MONEY_SENT',
      title: 'Payment successful',
      body: `Your payment of ${amountText} to @${recipient.username} was successful.`,
      data: { reference: posted.reference },
    });
    await recordAudit(tx, {
      action: AUDIT_ACTIONS.TRANSFER_COMPLETED,
      actorId: senderId,
      entityType: 'transaction',
      entityId: posted.id,
      context,
      metadata: {
        reference: posted.reference,
        amount: toAmountString(amount),
        recipientId: recipient.id,
      },
    });

    const result: TransferResult = {
      transaction: {
        id: posted.id,
        reference: posted.reference,
        type: isBusiness ? 'BUSINESS_PAYMENT' : 'TRANSFER',
        amount: toAmountString(amount),
        note: input.note ?? null,
        visibility,
        recipient: toCounterparty(recipient),
        createdAt: posted.createdAt.toISOString(),
      },
      balance: toAmountString(posted.fromBalanceAfter),
    };

    if (reservation) {
      await idempotencyRepository.complete(tx, reservation, 201, result, posted.id);
    }
    return result;
  });
}

/** People and businesses the user paid most recently (for quick picks). */
export async function recentRecipients(userId: string, limit = 8): Promise<PublicProfile[]> {
  const rows = await prisma.transaction.findMany({
    where: {
      initiatorId: userId,
      type: { in: ['TRANSFER', 'BUSINESS_PAYMENT', 'REQUEST_PAYMENT', 'SPLIT_PAYMENT'] },
      fromWallet: { userId },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      toWallet: { select: { user: { select: { ...publicProfileSelect, status: true } } } },
    },
  });

  const seen = new Set<string>();
  const recipients: PublicProfile[] = [];
  for (const { toWallet } of rows) {
    const user = toWallet.user;
    if (seen.has(user.id) || user.status !== 'ACTIVE') continue;
    seen.add(user.id);
    recipients.push(toPublicProfile(user));
    if (recipients.length === limit) break;
  }
  return recipients;
}
