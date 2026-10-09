import { z } from 'zod';
import { BRAND } from './brand.js';

/**
 * Money crosses the API as strings with exactly two decimals ("1500.00").
 * These helpers work on strings only — no floating point is ever involved.
 * Server-side arithmetic uses Decimal; the client only formats and validates.
 */

const AMOUNT_PATTERN = /^\d{1,13}(\.\d{1,2})?$/;

/**
 * Parses user input such as "1,500", "1500.5" or "KSh 1 500" into "1500.50".
 * Returns null for anything that is not a non-negative amount with ≤ 2 decimals.
 */
export function normalizeAmount(input: string): string | null {
  const compact = input.replace(/ksh|kes|[\s,]/gi, '');
  if (!AMOUNT_PATTERN.test(compact)) return null;
  const [whole = '0', fraction = ''] = compact.split('.');
  const wholeTrimmed = whole.replace(/^0+(?=\d)/, '');
  return `${wholeTrimmed}.${fraction.padEnd(2, '0')}`;
}

/** Validates and normalises a positive amount; bounds are enforced server-side. */
export const amountSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  const normalized = normalizeAmount(String(value));
  if (!normalized || /^0+\.00$/.test(normalized)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Enter an amount greater than zero, e.g. 1500 or 1500.50.',
    });
    return z.NEVER;
  }
  return normalized;
});

function groupThousands(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * "24850.00" → "KSh 24,850.00". Accepts negative values ("-500.00" → "-KSh 500.00").
 * `signed` prefixes positive amounts with "+".
 */
export function formatMoney(
  amount: string,
  options: { signed?: boolean; symbol?: boolean } = {},
): string {
  const { signed = false, symbol = true } = options;
  const negative = amount.trim().startsWith('-');
  const unsigned = amount.trim().replace(/^[-+]/, '');
  const [whole = '0', fraction = '00'] = unsigned.split('.');
  const body = `${groupThousands(whole)}.${fraction.padEnd(2, '0').slice(0, 2)}`;
  const withSymbol = symbol ? `${BRAND.currency.symbol} ${body}` : body;
  if (negative) return `-${withSymbol}`;
  return signed && !/^0+\.00$/.test(body.replace(/,/g, '')) ? `+${withSymbol}` : withSymbol;
}

/** Compares two non-negative 2-dp amount strings without floating point. */
export function compareAmounts(a: string, b: string): -1 | 0 | 1 {
  const toCents = (value: string) => BigInt(value.replace('.', ''));
  const left = toCents(normalizeAmount(a) ?? '0.00');
  const right = toCents(normalizeAmount(b) ?? '0.00');
  return left === right ? 0 : left < right ? -1 : 1;
}
