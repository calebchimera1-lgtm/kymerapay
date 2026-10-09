import {
  allocateEqualSplit,
  ERROR_CODES,
  formatMoney,
  type BillSplitDto,
  type CreateBillSplitData,
  type FieldIssue,
} from '@app/shared';
import { prisma } from '../config/database.js';
import { LIMITS } from '../config/limits.js';
import { billSplitInclude, toBillSplitDto } from '../mappers/request.mapper.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString, ZERO, type Money } from '../utils/money.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { createNotification } from './notification.service.js';

const REQUEST_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Upper bound for a single bill (shares are separately capped per payment). */
const MAX_BILL_TOTAL = money('1000000.00');

const notFound = () => AppError.notFound('Bill split not found.');

interface Share {
  userId: string;
  username: string;
  amount: Money;
}

/** Resolves @usernames to payable personal accounts, reporting every problem at once. */
async function resolveParticipants(creatorId: string, usernames: string[]) {
  const users = await prisma.user.findMany({
    where: { username: { in: usernames } },
    select: { id: true, username: true, role: true, status: true },
  });
  const byUsername = new Map(users.map((user) => [user.username, user]));
  const issues: FieldIssue[] = [];

  const resolved = usernames.map((username, index) => {
    const user = byUsername.get(username);
    const path = `participants.${index}.username`;
    if (!user || (user.role !== 'USER' && user.role !== 'BUSINESS')) {
      issues.push({ path, message: `We couldn't find @${username}.` });
    } else if (user.id === creatorId) {
      issues.push({
        path,
        message: 'You are included automatically — remove yourself from the list.',
      });
    } else if (user.role !== 'USER' || user.status !== 'ACTIVE') {
      issues.push({ path, message: `@${username} can't be added to a bill split.` });
    }
    return user;
  });

  if (issues.length > 0) throw AppError.validation(issues, 'Some people could not be added.');
  return resolved.map((user) => ({ id: user!.id, username: user!.username }));
}

/** Works out every share. The creator's share (if any) is returned separately. */
function computeShares(
  input: CreateBillSplitData,
  people: { id: string; username: string }[],
): { creatorShare: Money; shares: Share[] } {
  const total = money(input.totalAmount);

  if (input.method === 'EQUAL') {
    const parts = people.length + (input.includeSelf ? 1 : 0);
    const amounts = allocateEqualSplit(toAmountString(total), parts).map(money);
    // The creator takes the first share, so any extra cent stays with the person who paid the bill.
    const creatorShare = input.includeSelf ? amounts.shift()! : ZERO;
    return {
      creatorShare,
      shares: people.map((person, index) => ({
        userId: person.id,
        username: person.username,
        amount: amounts[index]!,
      })),
    };
  }

  const shares = people.map((person, index) => ({
    userId: person.id,
    username: person.username,
    amount: money(input.participants[index]!.amount!),
  }));
  const othersTotal = shares.reduce((sum, share) => sum.plus(share.amount), ZERO);
  const creatorShare = total.minus(othersTotal);

  if (creatorShare.lt(ZERO)) {
    throw AppError.validation([
      { path: 'participants', message: 'The shares add up to more than the total.' },
    ]);
  }
  if (!input.includeSelf && !creatorShare.isZero()) {
    throw AppError.validation([
      {
        path: 'participants',
        message: `The shares must add up to exactly ${formatMoney(toAmountString(total))}.`,
      },
    ]);
  }
  return { creatorShare, shares };
}

function assertShareBounds(shares: Share[]): void {
  const issues: FieldIssue[] = [];
  shares.forEach((share, index) => {
    if (share.amount.lt(LIMITS.minAmount) || share.amount.gt(LIMITS.maxAmount)) {
      issues.push({
        path: `participants.${index}.amount`,
        message: `@${share.username}'s share must be between ${formatMoney(toAmountString(LIMITS.minAmount))} and ${formatMoney(toAmountString(LIMITS.maxAmount))}.`,
      });
    }
  });
  if (issues.length > 0) {
    throw new AppError(
      ERROR_CODES.AMOUNT_OUT_OF_RANGE,
      'Some shares are outside the payment limits.',
      422,
      issues,
    );
  }
}

async function loadForParticipant(userId: string, id: string) {
  const split = await prisma.billSplit.findUnique({ where: { id }, include: billSplitInclude });
  if (!split) throw notFound();
  const involved =
    split.creatorId === userId || split.participants.some((p) => p.userId === userId);
  if (!involved) throw notFound();
  return split;
}

export const billSplitService = {
  /**
   * Creates the split, a share per person and a linked payment request for
   * everyone except the creator — all in one transaction. The creator's own
   * share is recorded as already settled (they paid the bill).
   */
  async create(
    creatorId: string,
    input: CreateBillSplitData,
    context: RequestContext,
  ): Promise<BillSplitDto> {
    const total = money(input.totalAmount);
    if (total.gt(MAX_BILL_TOTAL)) {
      throw new AppError(
        ERROR_CODES.AMOUNT_OUT_OF_RANGE,
        `A bill can be at most ${formatMoney(toAmountString(MAX_BILL_TOTAL))}.`,
        422,
      );
    }
    const people = await resolveParticipants(
      creatorId,
      input.participants.map((p) => p.username),
    );
    const { creatorShare, shares } = computeShares(input, people);
    assertShareBounds(shares);

    const creator = await prisma.user.findUniqueOrThrow({
      where: { id: creatorId },
      select: { username: true },
    });
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

    const splitId = await runInTransaction(async (tx) => {
      const split = await tx.billSplit.create({
        data: {
          creatorId,
          title: input.title,
          note: input.note ?? null,
          totalAmount: total,
          splitMethod: input.method,
        },
      });

      if (creatorShare.gt(ZERO)) {
        await tx.billParticipant.create({
          data: {
            billSplitId: split.id,
            userId: creatorId,
            amountOwed: creatorShare,
            amountPaid: creatorShare,
            status: 'SETTLED_SELF',
            paidAt: new Date(),
          },
        });
      }

      for (const share of shares) {
        const participant = await tx.billParticipant.create({
          data: { billSplitId: split.id, userId: share.userId, amountOwed: share.amount },
        });
        await tx.paymentRequest.create({
          data: {
            requesterId: creatorId,
            payerId: share.userId,
            amount: share.amount,
            note: input.title,
            expiresAt,
            billParticipantId: participant.id,
          },
        });
        await createNotification(tx, {
          userId: share.userId,
          type: 'SPLIT_CREATED',
          title: 'Bill split',
          body: `@${creator.username} split “${input.title}” — your share is ${formatMoney(toAmountString(share.amount))}.`,
          data: { billSplitId: split.id },
        });
      }

      await recordAudit(tx, {
        action: AUDIT_ACTIONS.SPLIT_CREATED,
        actorId: creatorId,
        entityType: 'bill_split',
        entityId: split.id,
        context,
        metadata: {
          total: toAmountString(total),
          participants: shares.length,
          method: input.method,
        },
      });
      return split.id;
    });

    return toBillSplitDto(await loadForParticipant(creatorId, splitId), creatorId);
  },

  async list(userId: string): Promise<BillSplitDto[]> {
    const splits = await prisma.billSplit.findMany({
      where: { OR: [{ creatorId: userId }, { participants: { some: { userId } } }] },
      include: billSplitInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
    });
    return splits.map((split) => toBillSplitDto(split, userId));
  },

  async get(userId: string, id: string): Promise<BillSplitDto> {
    return toBillSplitDto(await loadForParticipant(userId, id), userId);
  },

  /**
   * Cancels an open split: every unpaid share's request is cancelled. Shares
   * already paid stay paid (refunds are out of scope for V1).
   */
  async cancel(creatorId: string, id: string, context: RequestContext): Promise<BillSplitDto> {
    const split = await loadForParticipant(creatorId, id);
    if (split.creatorId !== creatorId) throw notFound();
    const creator = split.creator;

    await runInTransaction(async (tx) => {
      const changed = await tx.billSplit.updateMany({
        where: { id, status: 'OPEN' },
        data: { status: 'CANCELLED' },
      });
      if (changed.count === 0) {
        throw new AppError(ERROR_CODES.CONFLICT, 'Only open bill splits can be cancelled.', 409);
      }

      const pending = await tx.paymentRequest.findMany({
        where: { billParticipant: { billSplitId: id }, status: 'PENDING' },
        select: { id: true, payerId: true, billParticipantId: true },
      });
      for (const request of pending) {
        // Guarded: a share paid a moment ago keeps its PAID status.
        const cancelled = await tx.paymentRequest.updateMany({
          where: { id: request.id, status: 'PENDING' },
          data: { status: 'CANCELLED', respondedAt: new Date() },
        });
        if (cancelled.count === 0) continue;
        await tx.billParticipant.updateMany({
          where: { id: request.billParticipantId!, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
        await createNotification(tx, {
          userId: request.payerId,
          type: 'REQUEST_CANCELLED',
          title: 'Bill split cancelled',
          body: `@${creator.username} cancelled the bill split “${split.title}”. You don't need to pay.`,
          data: { billSplitId: id },
        });
      }

      await recordAudit(tx, {
        action: AUDIT_ACTIONS.SPLIT_CANCELLED,
        actorId: creatorId,
        entityType: 'bill_split',
        entityId: id,
        context,
      });
    });
    return toBillSplitDto(await loadForParticipant(creatorId, id), creatorId);
  },
};
