/**
 * Database seed — DEMO DATA ONLY, NO REAL MONEY.
 *
 * Creates the treasury, the demo people, the demo business and an admin, then
 * gives each wallet its opening balance through a FUNDING transaction from the
 * treasury (via the DemoProvider) — balances are never written directly.
 * Every account goes through the same validation schemas as real sign-ups.
 *
 * Idempotent: existing accounts are left untouched and a wallet is only
 * funded while it has no ledger history.
 * Demo credentials are for local development only — see README.
 */
import { registerBusinessSchema, registerUserSchema } from '@app/shared';
import { disconnectDatabase, prisma } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { insertAccount } from '../src/services/account.service.js';
import { ensureTreasury } from '../src/services/bootstrap.service.js';
import { fundWallet } from '../src/services/funding.service.js';
import { reconcileLedger } from '../src/services/reconciliation.service.js';
import { sendMoney } from '../src/services/transfer.service.js';
import { logger } from '../src/utils/logger.js';
import { money } from '../src/utils/money.js';
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

/** Opening simulated balances (KES). */
const OPENING_BALANCES: Record<string, string> = {
  caleb254: '25000.00',
  john254: '10000.00',
  brian254: '7500.00',
  mike254: '5000.00',
  david254: '5000.00',
  visiblegeneral: '50000.00',
};

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

async function seedOpeningBalances(): Promise<void> {
  const system = await prisma.user.findFirstOrThrow({ where: { role: 'SYSTEM' } });
  for (const [username, amount] of Object.entries(OPENING_BALANCES)) {
    const wallet = await prisma.wallet.findFirst({ where: { user: { username } } });
    if (!wallet) continue;
    const hasHistory = (await prisma.ledgerEntry.count({ where: { walletId: wallet.id } })) > 0;
    if (hasHistory) continue;
    const posted = await fundWallet({
      walletId: wallet.id,
      amount: money(amount),
      initiatorId: system.id,
      reason: 'Opening demo balance',
    });
    logger.info(`Funded @${username} with KSh ${amount} (simulated) — ${posted.reference}`);
  }
}

/** A little realistic history so dashboards aren't empty. Sent through the real transfer service. */
const SAMPLE_TRANSFERS: [from: string, to: string, amount: string, note: string][] = [
  ['john254', 'caleb254', '2000.00', 'Internet bill'],
  ['caleb254', 'john254', '1500.00', 'Lunch 😂'],
  ['brian254', 'caleb254', '500.00', 'Matatu fare'],
  ['caleb254', 'visiblegeneral', '3500.00', 'Stationery'],
  ['mike254', 'caleb254', '1200.00', 'Dinner split'],
  ['david254', 'brian254', '800.00', 'Football boots'],
];

async function seedSampleTransfers(): Promise<void> {
  const alreadySeeded = await prisma.transaction.count({
    where: { type: { in: ['TRANSFER', 'BUSINESS_PAYMENT'] } },
  });
  if (alreadySeeded > 0) return;

  const context = { ip: null, userAgent: 'seed', requestId: 'seed', deviceId: null };
  for (const [from, to, amount, note] of SAMPLE_TRANSFERS) {
    const sender = await prisma.user.findUniqueOrThrow({ where: { username: from } });
    const result = await sendMoney(
      sender.id,
      { recipient: to, amount, note, pin: DEMO_PIN },
      context,
    );
    logger.info(`Sample payment @${from} → @${to} KSh ${amount} — ${result.transaction.reference}`);
  }
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
  await seedOpeningBalances();
  await seedSampleTransfers();

  const report = await reconcileLedger();
  if (!report.healthy) throw new Error('Ledger reconciliation failed after seeding.');
  logger.info('Seed complete — all accounts are DEMO accounts with simulated money only.');
}

main()
  .catch((err: unknown) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(() => disconnectDatabase());
