import type { DbClient } from '../config/database.js';

export const sessionRepository = {
  findByTokenHash(db: DbClient, refreshTokenHash: string) {
    return db.session.findUnique({ where: { refreshTokenHash } });
  },

  /** Session plus the user fields needed to authorise a request. */
  findForAuth(db: DbClient, id: string) {
    return db.session.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: { role: true, status: true, tokenVersion: true } },
      },
    });
  },

  hasSessionWithFingerprint(db: DbClient, userId: string, fingerprintHash: string) {
    return db.session
      .findFirst({
        where: { userId, deviceFingerprintHash: fingerprintHash },
        select: { id: true },
      })
      .then(Boolean);
  },

  revoke(db: DbClient, id: string, reason: string) {
    return db.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  },

  revokeFamily(db: DbClient, familyId: string, reason: string) {
    return db.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  },

  revokeAllForUser(db: DbClient, userId: string, reason: string) {
    return db.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  },
};
