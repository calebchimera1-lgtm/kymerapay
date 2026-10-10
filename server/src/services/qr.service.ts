import {
  buildQrPayload,
  ERROR_CODES,
  formatMoney,
  type GenerateQrData,
  type QrCodeDto,
  type QrResolution,
} from '@app/shared';
import { prisma, type DbClient } from '../config/database.js';
import type { Prisma, QrCode, Role } from '../generated/prisma/client.js';
import { publicProfileSelect, toPublicProfile } from '../mappers/profile.mapper.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString, type Money } from '../utils/money.js';
import { generateQrCodeValue } from '../utils/qrCode.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { assertAmountWithinLimits } from './limits.service.js';

const invalid = () =>
  new AppError(ERROR_CODES.QR_INVALID, 'This QR code is not valid. Ask for a new one.', 404);
const expired = () =>
  new AppError(ERROR_CODES.QR_EXPIRED, 'This QR code has expired. Ask for a new one.', 410);

export function toQrCodeDto(qr: QrCode): QrCodeDto {
  return {
    id: qr.id,
    code: qr.code,
    payload: buildQrPayload(qr.code),
    type: qr.type,
    amount: qr.amount ? toAmountString(qr.amount) : null,
    note: qr.note,
    expiresAt: qr.expiresAt?.toISOString() ?? null,
    isActive: qr.isActive,
    scanCount: qr.scanCount,
    createdAt: qr.createdAt.toISOString(),
  };
}

/** Throws unless the code is live: active, not revoked, not expired, owned by a payable account. */
function assertLive(
  qr: (QrCode & { user: { status: string; role: Role } }) | null,
): asserts qr is QrCode & { user: { status: string; role: Role } } {
  if (!qr || !qr.isActive || qr.revokedAt) throw invalid();
  if (qr.user.status !== 'ACTIVE' || (qr.user.role !== 'USER' && qr.user.role !== 'BUSINESS'))
    throw invalid();
  if (qr.expiresAt && qr.expiresAt <= new Date()) throw expired();
}

export const qrService = {
  /** The caller's profile QR. Created on demand if an older account never had one. */
  async getMine(userId: string): Promise<QrCodeDto> {
    const existing = await prisma.qrCode.findFirst({
      where: { userId, type: 'STATIC', isActive: true },
    });
    if (existing) return toQrCodeDto(existing);
    const created = await prisma.qrCode.create({
      data: { userId, code: generateQrCodeValue(), type: 'STATIC' },
    });
    return toQrCodeDto(created);
  },

  async generate(
    userId: string,
    role: Role,
    input: GenerateQrData,
    context: RequestContext,
  ): Promise<QrCodeDto> {
    if (input.type === 'STATIC') {
      // Rotation: the old code stops working immediately (e.g. after a printed QR leaked).
      const rotated = await runInTransaction(async (tx) => {
        await tx.qrCode.updateMany({
          where: { userId, type: 'STATIC', isActive: true },
          data: { isActive: false, revokedAt: new Date() },
        });
        const created = await tx.qrCode.create({
          data: { userId, code: generateQrCodeValue(), type: 'STATIC' },
        });
        await recordAudit(tx, {
          action: AUDIT_ACTIONS.QR_ROTATED,
          actorId: userId,
          entityType: 'qr_code',
          entityId: created.id,
          context,
        });
        return created;
      });
      return toQrCodeDto(rotated);
    }

    if (role !== 'BUSINESS') {
      throw AppError.forbidden('Only business accounts can create QR codes for a fixed amount.');
    }
    const amount = money(input.amount);
    assertAmountWithinLimits(amount);
    const created = await runInTransaction(async (tx) => {
      const qr = await tx.qrCode.create({
        data: {
          userId,
          code: generateQrCodeValue(),
          type: 'DYNAMIC',
          amount,
          note: input.note ?? null,
          expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000),
        },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.QR_CREATED,
        actorId: userId,
        entityType: 'qr_code',
        entityId: qr.id,
        context,
        metadata: { amount: toAmountString(amount), expiresInMinutes: input.expiresInMinutes },
      });
      return qr;
    });
    return toQrCodeDto(created);
  },

  /** A business's fixed-amount codes that can still be paid, newest first. */
  async listActiveDynamic(userId: string): Promise<QrCodeDto[]> {
    const codes = await prisma.qrCode.findMany({
      where: { userId, type: 'DYNAMIC', isActive: true, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return codes.map(toQrCodeDto);
  },

  async revoke(userId: string, id: string, context: RequestContext): Promise<QrCodeDto> {
    const qr = await prisma.qrCode.findFirst({ where: { id, userId, type: 'DYNAMIC' } });
    if (!qr) throw AppError.notFound('QR code not found.');
    const updated = await runInTransaction(async (tx) => {
      const result = await tx.qrCode.update({
        where: { id },
        data: { isActive: false, revokedAt: new Date() },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.QR_REVOKED,
        actorId: userId,
        entityType: 'qr_code',
        entityId: id,
        context,
      });
      return result;
    });
    return toQrCodeDto(updated);
  },

  /**
   * Looks up who a scanned code would pay. Read-only with respect to money:
   * the client must still show a confirmation screen and the user must enter
   * their PIN. Only the payee's public profile is revealed.
   */
  async resolve(viewerId: string, code: string): Promise<QrResolution> {
    const qr = await prisma.qrCode.findUnique({
      where: { code },
      include: { user: { select: { ...publicProfileSelect, status: true } } },
    });
    assertLive(qr);
    await prisma.qrCode.update({
      where: { id: qr.id },
      data: { scanCount: { increment: 1 }, lastScannedAt: new Date() },
    });
    return {
      code: qr.code,
      type: qr.type,
      payee: toPublicProfile(qr.user),
      amount: qr.amount ? toAmountString(qr.amount) : null,
      note: qr.note,
      expiresAt: qr.expiresAt?.toISOString() ?? null,
      isOwn: qr.userId === viewerId,
    };
  },

  /**
   * Validates a code for a payment. Called once early (for a clear error before
   * the PIN step) and again inside the money transaction with `lock: true`,
   * where a fixed-amount code is consumed so it can only ever be paid once.
   */
  async validateForPayment(
    db: DbClient,
    code: string,
    recipientId: string,
    amount: Money,
    options: { lock?: boolean } = {},
  ): Promise<string> {
    if (options.lock) {
      await (db as Prisma.TransactionClient)
        .$queryRaw`SELECT id FROM qr_codes WHERE code = ${code} FOR UPDATE`;
    }
    const qr = await db.qrCode.findUnique({
      where: { code },
      include: { user: { select: { status: true, role: true } } },
    });
    assertLive(qr);
    if (qr.userId !== recipientId) throw invalid();
    if (qr.type === 'DYNAMIC' && qr.amount && !money(qr.amount).eq(amount)) {
      throw new AppError(
        ERROR_CODES.VALIDATION_ERROR,
        `This QR code is for exactly ${formatMoney(toAmountString(qr.amount))}.`,
        422,
        [{ path: 'amount', message: 'The amount must match the QR code.' }],
      );
    }
    if (options.lock && qr.type === 'DYNAMIC') {
      await db.qrCode.update({ where: { id: qr.id }, data: { isActive: false } });
    }
    return qr.id;
  },
};
