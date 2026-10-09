import { ERROR_CODES } from '@app/shared';
import { prisma } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/AppError.js';

/** Keys are remembered for 24 hours, after which the same key may be reused. */
const KEY_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * An IN_PROGRESS reservation older than this can be taken over. It must exceed
 * the longest possible money transaction (3 attempts × 15 s timeout + backoff),
 * so the original request can no longer commit when a takeover happens.
 */
const STALE_RESERVATION_MS = 2 * 60 * 1000;

/** Proof of a reservation. `fence` changes on takeover, invalidating the old holder. */
export interface IdempotencyReservation {
  id: string;
  fence: Date;
}

export type ReserveResult =
  | { kind: 'reserved'; reservation: IdempotencyReservation }
  | { kind: 'replay'; statusCode: number; body: unknown };

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export const idempotencyRepository = {
  async reserve(
    userId: string,
    key: string,
    endpoint: string,
    requestHash: string,
    attempt = 0,
  ): Promise<ReserveResult> {
    try {
      const created = await prisma.idempotencyKey.create({
        data: { userId, key, endpoint, requestHash, expiresAt: new Date(Date.now() + KEY_TTL_MS) },
        select: { id: true, updatedAt: true },
      });
      return { kind: 'reserved', reservation: { id: created.id, fence: created.updatedAt } };
    } catch (err) {
      if (!isUniqueViolation(err) || attempt > 2) throw err;
    }

    const existing = await prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (!existing) return this.reserve(userId, key, endpoint, requestHash, attempt + 1);

    if (existing.endpoint !== endpoint || existing.requestHash !== requestHash) {
      throw new AppError(
        ERROR_CODES.IDEMPOTENCY_KEY_REUSED,
        'This Idempotency-Key was already used for a different request.',
        422,
      );
    }

    const now = Date.now();
    if (existing.expiresAt.getTime() <= now) {
      await prisma.idempotencyKey.deleteMany({
        where: { id: existing.id, updatedAt: existing.updatedAt },
      });
      return this.reserve(userId, key, endpoint, requestHash, attempt + 1);
    }

    if (existing.status === 'COMPLETED') {
      return {
        kind: 'replay',
        statusCode: existing.responseCode ?? 200,
        body: existing.responseBody,
      };
    }

    if (now - existing.updatedAt.getTime() > STALE_RESERVATION_MS) {
      // The original request died without finishing. Take the reservation over;
      // bumping updatedAt changes the fence so the old holder can never complete.
      const takenOver = await prisma.idempotencyKey.updateMany({
        where: { id: existing.id, status: 'IN_PROGRESS', updatedAt: existing.updatedAt },
        data: { updatedAt: new Date() },
      });
      if (takenOver.count === 1) {
        const fresh = await prisma.idempotencyKey.findUniqueOrThrow({ where: { id: existing.id } });
        return { kind: 'reserved', reservation: { id: fresh.id, fence: fresh.updatedAt } };
      }
    }

    throw new AppError(
      ERROR_CODES.REQUEST_IN_PROGRESS,
      'This request is already being processed. Please wait a moment.',
      409,
    );
  },

  /**
   * Marks the reservation complete with the response to replay. Call inside the
   * same database transaction as the money movement: if this fails (the
   * reservation was taken over), the whole transaction rolls back.
   */
  async complete(
    tx: Prisma.TransactionClient,
    reservation: IdempotencyReservation,
    responseCode: number,
    /** A plain, JSON-serialisable DTO (the `data` of the success envelope). */
    responseBody: object,
    transactionId?: string,
  ): Promise<void> {
    const updated = await tx.idempotencyKey.updateMany({
      where: { id: reservation.id, status: 'IN_PROGRESS', updatedAt: reservation.fence },
      data: {
        status: 'COMPLETED',
        responseCode,
        responseBody: responseBody as Prisma.InputJsonValue,
        transactionId: transactionId ?? null,
      },
    });
    if (updated.count !== 1) {
      throw new AppError(
        ERROR_CODES.REQUEST_IN_PROGRESS,
        'This request was superseded by a retry.',
        409,
      );
    }
  },

  /** Frees a reservation whose request failed, so the client may retry with the same key. */
  async release(reservation: IdempotencyReservation): Promise<void> {
    await prisma.idempotencyKey.deleteMany({
      where: { id: reservation.id, status: 'IN_PROGRESS', updatedAt: reservation.fence },
    });
  },

  purgeExpired(): Promise<{ count: number }> {
    return prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },
};
