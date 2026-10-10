import { buildQrPayload, parseQrPayload } from '@app/shared';
import { describe, expect, it } from 'vitest';

const CODE = 'Ab3_kL9-QpX2rT7vWz1y';

describe('QR payloads', () => {
  it('builds an opaque scheme URI', () => {
    expect(buildQrPayload(CODE)).toBe(`kespay://pay/${CODE}`);
  });

  it.each([
    [CODE, CODE],
    [`kespay://pay/${CODE}`, CODE],
    [`KESPAY://pay/${CODE}/`, CODE],
    [`https://wallet.example.co.ke/pay/${CODE}`, CODE],
    [`http://localhost:5173/pay/${CODE}?utm=poster`, CODE],
    [`  kespay://pay/${CODE}  `, CODE],
  ])('parses %s', (input, expected) => {
    expect(parseQrPayload(input)).toBe(expected);
  });

  it.each([
    'PAY:@caleb254',
    'tel:+254712345678',
    'javascript:alert(1)',
    `ftp://host/pay/${CODE}`,
    `https://host/other/${CODE}`,
    `kespay://pay/${CODE}/../admin`,
    'short',
    '',
  ])('rejects %s', (input) => {
    expect(parseQrPayload(input)).toBeNull();
  });
});
