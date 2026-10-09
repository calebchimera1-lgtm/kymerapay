import { describe, expect, it } from 'vitest';
import {
  generateTransactionReference,
  TRANSACTION_REFERENCE_PATTERN,
} from '../../src/utils/reference.js';

describe('generateTransactionReference', () => {
  it('produces TXN- plus 10 unambiguous Crockford characters', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(generateTransactionReference()).toMatch(TRANSACTION_REFERENCE_PATTERN);
    }
  });

  it('does not repeat across many draws', () => {
    const refs = new Set(Array.from({ length: 10_000 }, generateTransactionReference));
    expect(refs.size).toBe(10_000);
  });
});
