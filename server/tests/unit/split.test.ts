import { allocateEqualSplit, sumAmounts } from '@app/shared';
import { describe, expect, it } from 'vitest';

describe('allocateEqualSplit', () => {
  it.each([
    ['6000.00', 5, ['1200.00', '1200.00', '1200.00', '1200.00', '1200.00']],
    ['1000.00', 3, ['333.34', '333.33', '333.33']],
    ['100.00', 6, ['16.67', '16.67', '16.67', '16.67', '16.66', '16.66']],
    ['0.05', 3, ['0.02', '0.02', '0.01']],
    ['250.50', 1, ['250.50']],
  ])('%s ÷ %i', (total, parts, expected) => {
    const shares = allocateEqualSplit(total, parts);
    expect(shares).toEqual(expected);
    expect(sumAmounts(shares)).toBe(total);
  });

  it('always sums exactly to the total', () => {
    for (let parts = 1; parts <= 20; parts += 1) {
      for (const total of ['1.00', '99.99', '1234.57', '150000.00']) {
        expect(sumAmounts(allocateEqualSplit(total, parts))).toBe(total);
      }
    }
  });

  it('rejects a non-positive part count', () => {
    expect(() => allocateEqualSplit('10.00', 0)).toThrow();
  });
});

describe('sumAmounts', () => {
  it('adds without floating-point drift', () => {
    expect(sumAmounts(['0.10', '0.20'])).toBe('0.30');
    expect(sumAmounts([])).toBe('0.00');
  });
});
