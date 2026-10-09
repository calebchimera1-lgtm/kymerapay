import {
  ERROR_CODES,
  formatMoney,
  type CreatePaymentRequestData,
  type ListPaymentRequestsQuery,
  type Paginated,
  type PaymentRequestDto,
  type PaymentRequestSummary,
  type PayRequestResult,
} from '@app/shared';
import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
  paymentRequestInclude,
  toPaymentRequestDto,
  type PaymentRequestRow,
} from '../mappers/request.mapper.js';
import { toCounterparty } from '../mappers/wallet.mapper.js';
import {
  idempotencyRepository,
  type IdempotencyReservation,
} from '../repositories/idempotency.repository.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString, ZERO } from '../utils/money.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { postTransfer } from './ledger.service.js';
import { assertAmountWithinLimits, assertWithinDailyLimit } from './limits.service.js';
import { createNotification } from './notification.service.js';
import { verifyPin } from './pin.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const STATUS_WORDS: Record<string, string> = {
  PAID: 'already been paid',
  DECLINED: 'been declined',
  CANCELLED: 'been cancelled',
  EXPIRED: 'expired',
};

const notFound = () => AppError.notFound('Payment request not found.');

function notPending(status: string): AppError {
  if (status === 'EXPIRED') return expired();
  return new AppError(
    ERROR_CODES.REQUEST_NOT_PENDING,
    `This request has ${STATUS_WORDS[status] ?? 'already been answered'}.`,
    409,
  );
}

const expired = () => new AppError(ERROR_CODES.REQUEST_EXPIRED, 'This request has expired.', 410);

/** Only the two parties may see or act on a request; to anyone else it does not exist. */
async function loadForParty(userId: string, id: string): Promise<PaymentRequestRow> {
  const row = await prisma.paymentRequest.findUnique({
    where: { id },
    include: paymentRequestInclude,
  });
  if (!row || (row.payerId !== userId && row.requesterId !== userId)) throw notFound();
  return row;
}

/** Marks a split share as answered when its request is. */
async function updateParticipant(
  tx: Prisma.TransactionClient,
  billParticipantId: string | null,
  status: 'DECLINED' | 'CANCELLED' | 'EXPIRED',
) {
  if (!billParticipantId) return;
  await tx.billParticipant.updateMany({
    where: { id: billParticipantId, status: 'PENDING' },
    data: { status },
  });
}

function listWhere(
  userId: string,
  query: ListPaymentRequestsQuery,
  now: Date,
): Prisma.PaymentRequestWhereInput {
  const party = query.direction === 'incoming' ? { payerId: userId } : { requesterId: userId };
  switch (query.status) {
    case undefined:
      return party;
    case 'PENDING':
      return { ...party, status: 'PENDING', expiresAt: { gt: now } };
    case 'EXPIRED':
      return {
        ...party,
        OR: [{ status: 'EXPIRED' }, { status: 'PENDING', expiresAt: { lte: now } }],
      };
    default:
      return { ...party, status: query.status };
  }
}

export const paymentRequestService = {
  async create(
    requesterId: string,
    input: CreatePaymentRequestData,
    context: RequestContext,
  ): Promise<PaymentRequestDto> {
    const amount = money(input.amount);
    assertAmountWithinLimits(amount);

    const payer = await prisma.user.findUnique({
      where: { username: input.payer },
      select: { id: true, role: true, status: true, username: true },
    });
    if (!payer || (payer.role !== 'USER' && payer.role !== 'BUSINESS')) {
      throw new AppError(ERROR_CODES.RECIPIENT_NOT_FOUND, `We couldn't find @${input.payer}.`, 404);
    }
    if (payer.id === requesterId) {
      throw new AppError(ERROR_CODES.SELF_TRANSFER, 'You cannot request money from yourself.', 422);
    }
    if (payer.role !== 'USER' || payer.status !== 'ACTIVE') {
      throw new AppError(
        ERROR_CODES.RECIPIENT_UNAVAILABLE,
        `@${payer.username} can't receive payment requests.`,
        422,
      );
    }

    const requester = await prisma.user.findUniqueOrThrow({
      where: { id: requesterId },
      select: { username: true },
    });
    const id = await runInTransaction(async (tx) => {
      const created = await tx.paymentRequest.create({
        data: {
          requesterId,
          payerId: payer.id,
          amount,
          note: input.note ?? null,
          expiresAt: new Date(Date.now() + input.expiresInDays * DAY_MS),
        },
      });
      await createNotification(tx, {
        userId: payer.id,
        type: 'REQUEST_RECEIVED',
        title: 'Payment request',
        body: `@${requester.username} requested ${formatMoney(toAmountString(amount))}.${input.note ? ` “${input.note}”` : ''}`,
        data: { paymentRequestId: created.id },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.REQUEST_CREATED,
        actorId: requesterId,
        entityType: 'payment_request',
        entityId: created.id,
        context,
        metadata: { amount: toAmountString(amount), payerId: payer.id },
      });
      return created.id;
    });
    return toPaymentRequestDto(await loadForParty(requesterId, id), requesterId);
  },

  async get(userId: string, id: string): Promise<PaymentRequestDto> {
    return toPaymentRequestDto(await loadForParty(userId, id), userId);
  },

  async list(
    userId: string,
    query: ListPaymentRequestsQuery,
  ): Promise<Paginated<PaymentRequestDto>> {
    const where = listWhere(userId, query, new Date());
    if (query.cursor) {
      const owned = await prisma.paymentRequest.count({ where: { ...where, id: query.cursor } });
      if (!owned) throw AppError.badRequest('Invalid cursor.');
    }
    const rows = await prisma.paymentRequest.findMany({
      where,
      include: paymentRequestInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => toPaymentRequestDto(row, userId)),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  },

  async summary(userId: string): Promise<PaymentRequestSummary> {
    const live = { status: 'PENDING' as const, expiresAt: { gt: new Date() } };
    const [incoming, outgoing] = await Promise.all([
      prisma.paymentRequest.aggregate({
        where: { ...live, payerId: userId },
        _count: true,
        _sum: { amount: true },
      }),
      prisma.paymentRequest.aggregate({
        where: { ...live, requesterId: userId },
        _count: true,
        _sum: { amount: true },
      }),
    ]);
    return {
      incomingPending: incoming._count,
      incomingPendingAmount: toAmountString(incoming._sum.amount ?? ZERO),
      outgoingPending: outgoing._count,
      outgoingPendingAmount: toAmountString(outgoing._sum.amount ?? ZERO),
    };
  },

  /**
   * Pays a request. The request row is locked (FOR UPDATE) for the whole
   * money transaction, so a concurrent pay/decline/cancel can never both win.
   */
  async pay(
    payerId: string,
    id: string,
    pin: string,
    context: RequestContext,
    reservation?: IdempotencyReservation,
  ): Promise<PayRequestResult> {
    const request = await loadForParty(payerId, id);
    if (request.payerId !== payerId) throw notFound();
    if (request.status !== 'PENDING') throw notPending(request.status);
    if (request.expiresAt <= new Date()) throw expired();

    const amount = money(request.amount);
    assertAmountWithinLimits(amount);
    await verifyPin(payerId, pin, context);

    const [payer, requester] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: payerId },
        select: { username: true, defaultVisibility: true, wallet: { select: { id: true } } },
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: request.requesterId },
        select: { username: true, role: true, wallet: { select: { id: true } } },
      }),
    ]);
    if (!payer.wallet || !requester.wallet)
      throw AppError.forbidden('This request cannot be paid.');
    const billParticipant = await prisma.billParticipant.findFirst({
      where: { paymentRequest: { id } },
      select: { id: true, billSplitId: true },
    });
    const amountText = formatMoney(toAmountString(amount));

    return runInTransaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ status: string; expiresAt: Date }[]>`
        SELECT status::text AS status, expires_at AS "expiresAt"
        FROM payment_requests WHERE id = ${id}::uuid FOR UPDATE`;
      if (!locked || locked.status !== 'PENDING') throw notPending(locked?.status ?? 'CANCELLED');
      if (locked.expiresAt <= new Date()) throw expired();

      const posted = await postTransfer(tx, {
        type: billParticipant ? 'SPLIT_PAYMENT' : 'REQUEST_PAYMENT',
        fromWalletId: payer.wallet!.id,
        toWalletId: requester.wallet!.id,
        amount,
        initiatorId: payerId,
        note: request.note,
        visibility: requester.role === 'BUSINESS' ? 'PRIVATE' : payer.defaultVisibility,
        paymentRequestId: id,
        ...(billParticipant ? { billSplitId: billParticipant.billSplitId } : {}),
        afterLock: () => assertWithinDailyLimit(tx, payer.wallet!.id, amount),
      });

      const now = new Date();
      await tx.paymentRequest.update({ where: { id }, data: { status: 'PAID', respondedAt: now } });

      if (billParticipant) {
        await tx.billParticipant.update({
          where: { id: billParticipant.id },
          data: { status: 'PAID', amountPaid: amount, paidAt: now },
        });
        const outstanding = await tx.billParticipant.count({
          where: {
            billSplitId: billParticipant.billSplitId,
            status: { notIn: ['PAID', 'SETTLED_SELF'] },
          },
        });
        if (outstanding === 0) {
          await tx.billSplit.updateMany({
            where: { id: billParticipant.billSplitId, status: 'OPEN' },
            data: { status: 'SETTLED' },
          });
        }
      }

      await createNotification(tx, {
        userId: request.requesterId,
        type: 'REQUEST_PAID',
        title: 'Request paid',
        body: `@${payer.username} paid your request of ${amountText}.`,
        data: { paymentRequestId: id, reference: posted.reference },
      });
      await createNotification(tx, {
        userId: payerId,
        type: 'MONEY_SENT',
        title: 'Payment successful',
        body: `Your payment of ${amountText} to @${requester.username} was successful.`,
        data: { reference: posted.reference },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.REQUEST_PAID,
        actorId: payerId,
        entityType: 'payment_request',
        entityId: id,
        context,
        metadata: { reference: posted.reference, amount: toAmountString(amount) },
      });

      const updated = await tx.paymentRequest.findUniqueOrThrow({
        where: { id },
        include: paymentRequestInclude,
      });
      const dto = toPaymentRequestDto(updated, payerId);
      const result: PayRequestResult = {
        request: dto,
        transaction: {
          id: posted.id,
          reference: posted.reference,
          type: billParticipant ? 'SPLIT_PAYMENT' : 'REQUEST_PAYMENT',
          amount: toAmountString(amount),
          note: request.note,
          visibility: requester.role === 'BUSINESS' ? 'PRIVATE' : payer.defaultVisibility,
          recipient: toCounterparty(updated.requester),
          createdAt: posted.createdAt.toISOString(),
        },
        balance: toAmountString(posted.fromBalanceAfter),
      };
      if (reservation)
        await idempotencyRepository.complete(tx, reservation, 201, result, posted.id);
      return result;
    });
  },

  async decline(payerId: string, id: string, context: RequestContext): Promise<PaymentRequestDto> {
    return respond(payerId, id, 'payer', context);
  },

  async cancel(
    requesterId: string,
    id: string,
    context: RequestContext,
  ): Promise<PaymentRequestDto> {
    return respond(requesterId, id, 'requester', context);
  },
};

/** Decline (by the payer) or cancel (by the requester) — a guarded PENDING → final transition. */
async function respond(
  userId: string,
  id: string,
  role: 'payer' | 'requester',
  context: RequestContext,
): Promise<PaymentRequestDto> {
  const request = await loadForParty(userId, id);
  if ((role === 'payer' ? request.payerId : request.requesterId) !== userId) throw notFound();

  const status = role === 'payer' ? 'DECLINED' : 'CANCELLED';
  const amountText = formatMoney(toAmountString(request.amount));
  const actor = role === 'payer' ? request.payer : request.requester;
  const billParticipant = await prisma.billParticipant.findFirst({
    where: { paymentRequest: { id } },
    select: { id: true },
  });

  await runInTransaction(async (tx) => {
    const now = new Date();
    const changed = await tx.paymentRequest.updateMany({
      where: { id, status: 'PENDING', expiresAt: { gt: now } },
      data: { status, respondedAt: now },
    });
    if (changed.count === 0) {
      const current = await tx.paymentRequest.findUniqueOrThrow({
        where: { id },
        select: { status: true, expiresAt: true },
      });
      throw current.status === 'PENDING' ? expired() : notPending(current.status);
    }
    await updateParticipant(tx, billParticipant?.id ?? null, status);
    await createNotification(tx, {
      userId: role === 'payer' ? request.requesterId : request.payerId,
      type: role === 'payer' ? 'REQUEST_DECLINED' : 'REQUEST_CANCELLED',
      title: role === 'payer' ? 'Request declined' : 'Request cancelled',
      body:
        role === 'payer'
          ? `@${actor.username} declined your request of ${amountText}.`
          : `@${actor.username} cancelled their request of ${amountText}.`,
      data: { paymentRequestId: id },
    });
    await recordAudit(tx, {
      action: role === 'payer' ? AUDIT_ACTIONS.REQUEST_DECLINED : AUDIT_ACTIONS.REQUEST_CANCELLED,
      actorId: userId,
      entityType: 'payment_request',
      entityId: id,
      context,
    });
  });
  return toPaymentRequestDto(await loadForParty(userId, id), userId);
}

/**
 * Persists EXPIRED for overdue PENDING requests and tells the requester.
 * Safe to run concurrently: each transition is a guarded conditional update.
 */
export async function expireOverdueRequests(batchSize = 200): Promise<number> {
  const overdue = await prisma.paymentRequest.findMany({
    where: { status: 'PENDING', expiresAt: { lte: new Date() } },
    select: {
      id: true,
      requesterId: true,
      amount: true,
      payer: { select: { username: true } },
      billParticipant: { select: { id: true } },
    },
    take: batchSize,
  });

  let expiredCount = 0;
  for (const request of overdue) {
    await runInTransaction(async (tx) => {
      const changed = await tx.paymentRequest.updateMany({
        where: { id: request.id, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      if (changed.count === 0) return;
      expiredCount += 1;
      await updateParticipant(tx, request.billParticipant?.id ?? null, 'EXPIRED');
      await createNotification(tx, {
        userId: request.requesterId,
        type: 'REQUEST_EXPIRED',
        title: 'Request expired',
        body: `Your request to @${request.payer.username} for ${formatMoney(toAmountString(request.amount))} expired.`,
        data: { paymentRequestId: request.id },
      });
    });
  }
  return expiredCount;
}
