/**
 * Database seed — DEMO DATA ONLY, NO REAL MONEY.
 *
 * Creates the treasury, the demo people, the demo business and an admin.
 * Every account goes through the same validation schemas as real sign-ups.
 * Simulated balances are added in Phase 4 through proper FUNDING transactions
 * from the treasury (never by writing balances directly).
 *
 * Idempotent: accounts that already exist are left untouched.
 * Demo credentials are for local development only — see README.
 */
import { registerBusinessSchema, registerUserSchema } from '@app/shared';
import { disconnectDatabase, prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { insertAccount } from '../src/services/account.service.js';
import { ensureTreasury } from '../src/services/bootstrap.service.js';
import { logger } from '../src/utils/logger.js';
import { hashSecret } from '../src/utils/password.js';

export const DEMO_PASSWORD = 'Demo@2026';
export const DEMO_PIN = '1357';
export const DEMO_ADMIN = {
  username: 'admin',
  email: 'admin@kespay.demo',
  fullName: 'Platform Admin (Demo)',
  password: 'Admin@2026',
};

const DEMO_PEOPLE = [
  {
    fullName: 'Caleb Chimera',
    username: 'caleb254',
    email: 'caleb@kespay.demo',
    phone: '0712000254',
  },
  { fullName: 'John Kamau', username: 'john254', email: 'john@kespay.demo', phone: '0722000254' },
  {
    fullName: 'Brian Otieno',
    username: 'brian254',
    email: 'brian@kespay.demo',
    phone: '0733000254',
  },
  { fullName: 'Mike Mwangi', username: 'mike254', email: 'mike@kespay.demo', phone: '0744000254' },
  {
    fullName: 'David Kiprop',
    username: 'david254',
    email: 'david@kespay.demo',
    phone: '0755000254',
  },
];

const DEMO_BUSINESS = {
  businessName: 'VISIBLE GENERAL SUPPLIES LTD',
  username: 'visiblegeneral',
  category: 'RETAIL' as const,
  location: 'Moi Avenue, Nairobi',
  description: 'Hardware, stationery and general supplies. Demo business account.',
  email: 'sales@visiblegeneral.demo',
  phone: '0110000254',
};

async function exists(username: string): Promise<boolean> {
  return (await prisma.user.count({ where: { username } })) > 0;
}

async function seedPeople(passwordHash: string, pinHash: string): Promise<void> {
  for (const person of DEMO_PEOPLE) {
    const data = registerUserSchema.parse({ ...person, password: DEMO_PASSWORD, pin: DEMO_PIN });
    if (await exists(data.username)) continue;
    await prisma.$transaction((tx) =>
      insertAccount(tx, { ...data, role: 'USER', passwordHash, pinHash }),
    );
    logger.info(`Seeded demo user @${data.username}`);
  }
}

async function seedBusiness(passwordHash: string, pinHash: string): Promise<void> {
  const data = registerBusinessSchema.parse({
    ...DEMO_BUSINESS,
    password: DEMO_PASSWORD,
    pin: DEMO_PIN,
  });
  if (await exists(data.username)) return;
  const { username, email, phone, password: _password, pin: _pin, ...business } = data;
  await prisma.$transaction((tx) =>
    insertAccount(tx, {
      role: 'BUSINESS',
      fullName: business.businessName,
      username,
      email,
      phone,
      passwordHash,
      pinHash,
      business,
    }),
  );
  logger.info(`Seeded demo business @${username}`);
}

async function seedAdmin(): Promise<void> {
  if (await exists(DEMO_ADMIN.username)) return;
  // Admins sign in but never hold a wallet or a PIN (separation of duties).
  await prisma.user.create({
    data: {
      fullName: DEMO_ADMIN.fullName,
      username: DEMO_ADMIN.username,
      email: DEMO_ADMIN.email,
      role: 'ADMIN',
      passwordHash: await hashSecret(DEMO_ADMIN.password),
      isDemo: true,
    },
  });
  logger.info(`Seeded demo admin @${DEMO_ADMIN.username}`);
}

async function main(): Promise<void> {
  if (env.isProduction && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Refusing to seed demo accounts in production without ALLOW_DEMO_SEED=true.');
  }

  await ensureTreasury(prisma);
  const [passwordHash, pinHash] = await Promise.all([
    hashSecret(DEMO_PASSWORD),
    hashSecret(DEMO_PIN),
  ]);
  await seedPeople(passwordHash, pinHash);
  await seedBusiness(passwordHash, pinHash);
  await seedAdmin();
  logger.info('Seed complete — all accounts are DEMO accounts with simulated money only.');
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
