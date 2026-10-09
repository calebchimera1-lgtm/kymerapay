/**
 * A fresh key per *intended* payment. Reusing the same key when retrying the
 * same confirmation guarantees the server moves money at most once, even if
 * the first response was lost on a bad connection.
 */
export function newIdempotencyKey(): string {
  return `web-${crypto.randomUUID()}`;
}
