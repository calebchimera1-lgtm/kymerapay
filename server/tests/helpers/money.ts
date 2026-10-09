import { prisma } from '../../src/config/database.js';
import { fundWallet } from '../../src/services/funding.service.js';
import { money } from '../../src/utils/money.js';

/** Gives a user's wallet simulated money the proper way (FUNDING from the treasury). */
export async function fundUser(userId: string, amount: string) {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  const system = await prisma.user.findFirstOrThrow({ where: { role: 'SYSTEM' } });
  return fundWallet({
    walletId: wallet.id,
    amount: money(amount),
    initiatorId: system.id,
    reason: 'Test funds',
  });
}

export async function balanceOf(userId: string): Promise<string> {
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId } });
  return wallet.balance.toFixed(2);
}

export async function walletIdOf(userId: string): Promise<string> {
  return (await prisma.wallet.findUniqueOrThrow({ where: { userId } })).id;
}
