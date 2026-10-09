import { randomUUID } from 'node:crypto';
import type { Role } from '../../src/generated/prisma/client.js';
import { prisma } from '../../src/config/database.js';

let counter = 0;

/** Unique, constraint-valid phone number per call. */
function nextPhone(): string {
  counter += 1;
  return `+2547${String(10_000_000 + counter).slice(-8)}`;
}

interface TestUserOptions {
  username?: string;
  role?: Extract<Role, 'USER' | 'BUSINESS'>;
}

/**
 * Inserts a user with a wallet directly (bypassing the auth service, which
 * arrives in Phase 3). Hash columns hold placeholders — these users are for
 * database-level tests only and cannot sign in.
 */
export async function createUserWithWallet({ username, role = 'USER' }: TestUserOptions = {}) {
  return prisma.user.create({
    data: {
      ...userData(username, role),
      wallet: { create: { type: role === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL' } },
    },
    include: { wallet: true },
  });
}

/** Same as createUserWithWallet, for tests that create the wallet themselves. */
export async function createUserWithoutWallet({ username, role = 'USER' }: TestUserOptions = {}) {
  return prisma.user.create({ data: userData(username, role) });
}

function userData(username: string | undefined, role: Extract<Role, 'USER' | 'BUSINESS'>) {
  const handle = username ?? `user_${randomUUID().slice(0, 8)}`;
  return {
    fullName: `Test ${handle}`,
    username: handle,
    email: `${handle}@example.test`,
    phone: nextPhone(),
    passwordHash: 'placeholder-not-a-real-hash',
    pinHash: 'placeholder-not-a-real-hash',
    role,
  };
}
