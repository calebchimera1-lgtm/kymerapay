import { z } from 'zod';
import { BRAND } from './brand.js';
import { amountSchema } from './money.js';
import type { PublicProfile } from './transfer.js';
import { noteSchema } from './validation/transfer.js';

/** Opaque, unguessable code embedded in a QR (never a username or phone number). */
export const QR_CODE_PATTERN = /^[A-Za-z0-9_-]{16,32}$/;

/** What the QR image encodes, e.g. `kespay://pay/7Hq…`. */
export function buildQrPayload(code: string): string {
  return `${BRAND.qrScheme}://pay/${code}`;
}

/**
 * Extracts the code from anything a scanner might return: our URI scheme,
 * a web link ending in `/pay/<code>`, or a bare code. Returns null for
 * anything else — scanned text is untrusted input and is never executed.
 */
export function parseQrPayload(text: string): string | null {
  const value = text.trim();
  if (QR_CODE_PATTERN.test(value)) return value;

  const scheme = new RegExp(`^${BRAND.qrScheme}://pay/([A-Za-z0-9_-]{16,32})/?$`, 'i');
  const fromScheme = scheme.exec(value);
  if (fromScheme) return fromScheme[1]!;

  // A web link such as https://wallet.example/pay/<code> (e.g. from a phone's camera app).
  const fromLink = /^https?:\/\/[^\s/?#]+\/pay\/([A-Za-z0-9_-]{16,32})\/?(?:[?#]\S*)?$/i.exec(
    value,
  );
  return fromLink ? fromLink[1]! : null;
}

export const qrCodeParamSchema = z.object({
  code: z.string().regex(QR_CODE_PATTERN, 'Invalid QR code.'),
});

/** `POST /api/qr/generate` */
export const generateQrSchema = z.discriminatedUnion('type', [
  /** Replaces your profile QR (the old one stops working). */
  z.object({ type: z.literal('STATIC') }),
  /** A one-time QR for a fixed amount (businesses). */
  z.object({
    type: z.literal('DYNAMIC'),
    amount: amountSchema,
    note: noteSchema,
    expiresInMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  }),
]);
export type GenerateQrInput = z.input<typeof generateQrSchema>;
export type GenerateQrData = z.output<typeof generateQrSchema>;

export interface QrCodeDto {
  id: string;
  code: string;
  /** Text to render into the QR image. */
  payload: string;
  type: 'STATIC' | 'DYNAMIC';
  amount: string | null;
  note: string | null;
  expiresAt: string | null;
  isActive: boolean;
  scanCount: number;
  createdAt: string;
}

/** `GET /api/qr/resolve/:code` — who you would pay. Never moves money. */
export interface QrResolution {
  code: string;
  type: 'STATIC' | 'DYNAMIC';
  payee: PublicProfile;
  /** Fixed amount for DYNAMIC codes; null means the payer enters it. */
  amount: string | null;
  note: string | null;
  expiresAt: string | null;
  /** The scanner's own code — the client should not offer to pay it. */
  isOwn: boolean;
}
