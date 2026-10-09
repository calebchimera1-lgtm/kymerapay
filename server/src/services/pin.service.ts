import { ERROR_CODES } from '@app/shared';
import { prisma } from '../config/database.js';
import { SECURITY } from '../config/security.js';
import { AppError } from '../utils/AppError.js';
import { verifySecret } from '../utils/password.js';
import type { RequestContext } from '../utils/requestContext.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { createNotification } from './notification.service.js';

function pinLockedError(until: Date): AppError {
  const minutes = Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000));
  return new AppError(
    ERROR_CODES.PIN_LOCKED,
    `Too many incorrect PIN attempts. Payments are paused for ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    423,
  );
}

/**
 * Confirms the transaction PIN before money moves. Repeated failures pause
 * payments for the account (separate from the password lockout).
 *
 * Uses 403 rather than 401 so clients don't mistake a wrong PIN for an expired session.
 */
export async function verifyPin(
  userId: string,
  pin: string,
  context: RequestContext,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, pinHash: true, pinLockedUntil: true, failedPinCount: true },
  });
  if (!user?.pinHash) throw AppError.forbidden('This account cannot authorise payments.');
  if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
    throw pinLockedError(user.pinLockedUntil);
  }

  if (await verifySecret(user.pinHash, pin)) {
    if (user.failedPinCount > 0 || user.pinLockedUntil) {
      await prisma.user.update({
        where: { id: userId },
        data: { failedPinCount: 0, pinLockedUntil: null },
      });
    }
    return;
  }

  const { failedPinCount } = await prisma.user.update({
    where: { id: userId },
    data: { failedPinCount: { increment: 1 } },
    select: { failedPinCount: true },
  });

  if (failedPinCount >= SECURITY.maxFailedPins) {
    const lockedUntil = new Date(Date.now() + SECURITY.pinLockMinutes * 60_000);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { pinLockedUntil: lockedUntil, failedPinCount: 0 },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.PIN_LOCKED,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        context,
      });
      await createNotification(tx, {
        userId,
        type: 'SECURITY',
        title: 'Payments paused',
        body: `Your PIN was entered incorrectly too many times. Payments are paused for ${SECURITY.pinLockMinutes} minutes.`,
      });
    });
    throw pinLockedError(lockedUntil);
  }

  await recordAudit(prisma, {
    action: AUDIT_ACTIONS.PIN_FAILED,
    actorId: userId,
    entityType: 'user',
    entityId: userId,
    context,
    metadata: { failedPinCount },
  });
  const remaining = SECURITY.maxFailedPins - failedPinCount;
  throw new AppError(
    ERROR_CODES.INVALID_PIN,
    `Incorrect PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`,
    403,
  );
}
