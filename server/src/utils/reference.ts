import { randomInt } from 'node:crypto';

/** Crockford base32: no I, L, O or U, so references are easy to read aloud. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REFERENCE_LENGTH = 10;

/**
 * Generates a transaction reference such as `TXN-7Q2M9XK4PA`.
 * 32^10 ≈ 1.1 × 10^15 combinations from a CSPRNG; uniqueness is still
 * enforced by a database constraint and callers retry on collision.
 */
export function generateTransactionReference(): string {
  let body = '';
  for (let i = 0; i < REFERENCE_LENGTH; i += 1) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `TXN-${body}`;
}

export const TRANSACTION_REFERENCE_PATTERN = /^TXN-[0-9A-HJKMNP-TV-Z]{10}$/;
