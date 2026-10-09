import argon2, { type HashOptions } from 'argon2';
import { env } from '../config/env.js';

/**
 * argon2id with OWASP's recommended minimum (19 MiB, 2 iterations). Tests use a
 * cheaper profile purely for speed; verification reads the parameters stored
 * in each hash, so the two profiles are interchangeable.
 */
const HASH_OPTIONS: HashOptions = env.isTest
  ? { type: argon2.argon2id, memoryCost: 1024, timeCost: 2, parallelism: 1 }
  : { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 };

/** Hashes a password or PIN. Plaintext secrets are never stored or logged. */
export function hashSecret(plain: string): Promise<string> {
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

let equaliserHash: Promise<string> | undefined;

/**
 * Performs a verification against a throwaway hash, so a login for an unknown
 * account takes as long as one for a real account (prevents user enumeration
 * by timing).
 */
export async function burnVerification(plain: string): Promise<void> {
  equaliserHash ??= hashSecret('timing-equaliser');
  await verifySecret(await equaliserHash, plain);
}
