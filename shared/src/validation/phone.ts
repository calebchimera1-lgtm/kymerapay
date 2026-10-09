/**
 * Kenyan mobile numbers. Accepts the common ways people type them and
 * normalises to E.164: `+2547XXXXXXXX` or `+2541XXXXXXXX`.
 *
 *   0712 345 678 · 712345678 · 254712345678 · +254 712-345-678 · 0112345678
 */
const KENYAN_MOBILE = /^(?:\+?254|0)?([17]\d{8})$/;

export function normalizeKenyanPhone(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, '');
  const match = KENYAN_MOBILE.exec(compact);
  return match ? `+254${match[1]}` : null;
}

/** True when the input already looks like a phone number rather than a username/e-mail. */
export function looksLikePhone(input: string): boolean {
  return /^\+?[\d\s\-().]{9,16}$/.test(input.trim());
}

/** `+254712345678` → `+254 712 345 678` for display. */
export function formatKenyanPhone(e164: string): string {
  const match = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return match ? `+254 ${match[1]} ${match[2]} ${match[3]}` : e164;
}
