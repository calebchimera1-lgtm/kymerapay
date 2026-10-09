/**
 * Splits `total` (a 2-dp amount string) into `parts` shares that add up to the
 * total *exactly*. Leftover cents go to the first shares, one cent each:
 *   1000.00 ÷ 3 → 333.34, 333.33, 333.33
 *   6000.00 ÷ 5 → 1200.00 × 5
 * Integer cents via BigInt — no floating point. Shared so the client preview
 * and the server allocation can never disagree.
 */
export function allocateEqualSplit(total: string, parts: number): string[] {
  if (!Number.isInteger(parts) || parts < 1) throw new Error('parts must be a positive integer');
  const [whole = '0', fraction = ''] = total.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  const count = BigInt(parts);
  const base = cents / count;
  const remainder = cents % count;

  return Array.from({ length: parts }, (_, index) => {
    const share = base + (BigInt(index) < remainder ? 1n : 0n);
    return `${share / 100n}.${String(share % 100n).padStart(2, '0')}`;
  });
}

/** Sum of 2-dp amount strings, as a 2-dp string (BigInt cents). */
export function sumAmounts(amounts: readonly string[]): string {
  const cents = amounts.reduce((acc, amount) => {
    const [whole = '0', fraction = ''] = amount.split('.');
    return acc + BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  }, 0n);
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}

function toCents(amount: string): bigint {
  const negative = amount.trim().startsWith('-');
  const [whole = '0', fraction = ''] = amount.trim().replace(/^[-+]/, '').split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  return negative ? -cents : cents;
}

/** a − b for 2-dp amount strings; may be negative ("-12.50"). */
export function subtractAmounts(a: string, b: string): string {
  const cents = toCents(a) - toCents(b);
  const abs = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}${abs / 100n}.${String(abs % 100n).padStart(2, '0')}`;
}
