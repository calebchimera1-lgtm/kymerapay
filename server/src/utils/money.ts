import { Prisma } from '../generated/prisma/client.js';

/**
 * Server-side money arithmetic. Always Decimal (decimal.js under the hood),
 * never JavaScript numbers. Values leave the API as 2-dp strings.
 */
export type Money = Prisma.Decimal;
type MoneyInput = Money | string | number;

export function money(value: MoneyInput): Money {
  return new Prisma.Decimal(value);
}

export const ZERO = money(0);

/** "1500.00" — the only format amounts are serialised in. */
export function toAmountString(value: MoneyInput): string {
  return money(value).toFixed(2);
}

/** True when the value has at most two decimal places. */
export function hasCentsPrecision(value: Money): boolean {
  return value.decimalPlaces() <= 2;
}
