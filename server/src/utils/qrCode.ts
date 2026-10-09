import { randomBytes } from 'node:crypto';

/**
 * Opaque, unguessable payment code (144 bits, 24 URL-safe chars). QR codes
 * carry this instead of a username or phone number.
 */
export function generateQrCodeValue(): string {
  return randomBytes(18).toString('base64url');
}
