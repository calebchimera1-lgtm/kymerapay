import { randomInt } from 'node:crypto';
import type { DbClient } from '../config/database.js';
import type { OtpPurpose } from '../generated/prisma/client.js';
import { ConsoleOtpProvider } from '../providers/otp/ConsoleOtpProvider.js';
import type { OtpProvider } from '../providers/otp/OtpProvider.js';
import { sha256 } from '../utils/crypto.js';

const OTP_TTL_MS = 5 * 60_000;

/**
 * OTP challenge lifecycle, prepared for future phone verification, step-up
 * login and PIN reset. Not wired into any V1 flow.
 */
export function createOtpService(provider: OtpProvider = new ConsoleOtpProvider()) {
  return {
    async issue(db: DbClient, userId: string, destination: string, purpose: OtpPurpose) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
      const expiresAt = new Date(Date.now() + OTP_TTL_MS);
      const challenge = await db.otpChallenge.create({
        data: { userId, purpose, codeHash: sha256(`${userId}:${purpose}:${code}`), expiresAt },
      });
      await provider.send({ destination, code, purpose, expiresAt });
      return { challengeId: challenge.id, expiresAt };
    },

    /** Returns true once for a correct, unexpired code; counts failed attempts. */
    async verify(
      db: DbClient,
      challengeId: string,
      userId: string,
      code: string,
    ): Promise<boolean> {
      const challenge = await db.otpChallenge.findFirst({
        where: { id: challengeId, userId, consumedAt: null },
      });
      if (!challenge || challenge.expiresAt <= new Date()) return false;
      if (challenge.attempts >= challenge.maxAttempts) return false;

      const matches = challenge.codeHash === sha256(`${userId}:${challenge.purpose}:${code}`);
      await db.otpChallenge.update({
        where: { id: challenge.id },
        data: matches ? { consumedAt: new Date() } : { attempts: { increment: 1 } },
      });
      return matches;
    },
  };
}
