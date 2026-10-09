import { amountSchema, compareAmounts, formatMoney, normalizeAmount } from '@app/shared';
import { describe, expect, it } from 'vitest';
import { hasCentsPrecision, money, toAmountString } from '../../src/utils/money.js';

describe('normalizeAmount', () => {
  it.each([
    ['1500', '1500.00'],
    ['1,500', '1500.00'],
    ['1500.5', '1500.50'],
    ['KSh 1 500.25', '1500.25'],
    ['0.10', '0.10'],
    ['007', '7.00'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeAmount(input)).toBe(expected);
  });

  it.each(['-5', '1.234', 'abc', '', '1e3', '12.3.4', '99999999999999'])('rejects %s', (input) => {
    expect(normalizeAmount(input)).toBeNull();
  });
});

describe('amountSchema', () => {
  it('normalises numbers and strings', () => {
    expect(amountSchema.parse(1500)).toBe('1500.00');
    expect(amountSchema.parse('2,000.5')).toBe('2000.50');
  });

  it.each(['0', '0.00', '-1', '1.005'])('rejects %s', (value) => {
    expect(amountSchema.safeParse(value).success).toBe(false);
  });
});

describe('formatMoney', () => {
  it.each([
    ['24850.00', {}, 'KSh 24,850.00'],
    ['1500', {}, 'KSh 1,500.00'],
    ['1234567.5', {}, 'KSh 1,234,567.50'],
    ['-500.00', {}, '-KSh 500.00'],
    ['500.00', { signed: true }, '+KSh 500.00'],
    ['0.00', { signed: true }, 'KSh 0.00'],
    ['999.99', { symbol: false }, '999.99'],
  ] as const)('%s %o → %s', (amount, options, expected) => {
    expect(formatMoney(amount, options)).toBe(expected);
  });
});

describe('compareAmounts', () => {
  it('compares without floating point', () => {
    expect(compareAmounts('0.30', '0.3')).toBe(0);
    expect(compareAmounts('1500.01', '1500.00')).toBe(1);
    expect(compareAmounts('99999999999.99', '100000000000.00')).toBe(-1);
  });
});

describe('server Decimal helpers', () => {
  it('adds 0.1 + 0.2 exactly', () => {
    expect(toAmountString(money('0.1').plus(money('0.2')))).toBe('0.30');
  });

  it('detects sub-cent precision', () => {
    expect(hasCentsPrecision(money('10.25'))).toBe(true);
    expect(hasCentsPrecision(money('10.255'))).toBe(false);
  });
});
