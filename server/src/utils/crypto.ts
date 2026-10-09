import { createHash, randomBytes } from 'node:crypto';

/** Hex SHA-256. Used for refresh tokens and fingerprints — high-entropy inputs only. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** URL-safe random token from a CSPRNG (default 384 bits). */
export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}
