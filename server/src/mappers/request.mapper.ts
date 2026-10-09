import type { BillParticipantDto, BillSplitDto, PaymentRequestDto } from '@app/shared';
import type { Prisma } from '../generated/prisma/client.js';
import { counterpartyUserSelect } from '../repositories/selects.js';
import { money, toAmountString, ZERO } from '../utils/money.js';
import { toCounterparty } from './wallet.mapper.js';

export const paymentRequestInclude = {
  requester: { select: counterpartyUserSelect },
  payer: { select: counterpartyUserSelect },
  billParticipant: { select: { billSplit: { select: { id: true, title: true } } } },
  transaction: { select: { reference: true } },
} satisfies Prisma.PaymentRequestInclude;

export type PaymentRequestRow = Prisma.PaymentRequestGetPayload<{
  include: typeof paymentRequestInclude;
}>;

/** PENDING past its expiry is reported as EXPIRED even before the sweeper persists it. */
export function effectiveRequestStatus(
  row: { status: PaymentRequestDto['status']; expiresAt: Date },
  now = new Date(),
) {
  return row.status === 'PENDING' && row.expiresAt <= now ? 'EXPIRED' : row.status;
}

export function toPaymentRequestDto(row: PaymentRequestRow, viewerId: string): PaymentRequestDto {
  const incoming = row.payerId === viewerId;
  return {
    id: row.id,
    direction: incoming ? 'incoming' : 'outgoing',
    status: effectiveRequestStatus(row),
    amount: toAmountString(row.amount),
    note: row.note,
    counterparty: toCounterparty(incoming ? row.requester : row.payer),
    billSplit: row.billParticipant?.billSplit ?? null,
    transactionReference: row.transaction?.reference ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
  };
}

export const billSplitInclude = {
  creator: { select: counterpartyUserSelect },
  participants: {
    include: {
      user: { select: counterpartyUserSelect },
      paymentRequest: { select: { id: true, status: true, expiresAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.BillSplitInclude;

export type BillSplitRow = Prisma.BillSplitGetPayload<{ include: typeof billSplitInclude }>;

export function toBillSplitDto(row: BillSplitRow, viewerId: string): BillSplitDto {
  const now = new Date();
  let paid = ZERO;
  const participants = row.participants.map((participant) => {
    paid = paid.plus(participant.amountPaid);
    const request = participant.paymentRequest;
    const status: BillParticipantDto['status'] =
      participant.status === 'PENDING' &&
      request &&
      effectiveRequestStatus(request, now) === 'EXPIRED'
        ? 'EXPIRED'
        : participant.status;
    return {
      id: participant.id,
      user: toCounterparty(participant.user),
      isCreator: participant.userId === row.creatorId,
      amountOwed: toAmountString(participant.amountOwed),
      amountPaid: toAmountString(participant.amountPaid),
      status,
      paymentRequestId: request?.id ?? null,
      paidAt: participant.paidAt?.toISOString() ?? null,
    };
  });

  return {
    id: row.id,
    title: row.title,
    note: row.note,
    totalAmount: toAmountString(row.totalAmount),
    method: row.splitMethod,
    status: row.status,
    isCreator: row.creatorId === viewerId,
    creator: toCounterparty(row.creator),
    participants,
    amountPaid: toAmountString(paid),
    amountRemaining: toAmountString(money(row.totalAmount).minus(paid)),
    createdAt: row.createdAt.toISOString(),
  };
}
