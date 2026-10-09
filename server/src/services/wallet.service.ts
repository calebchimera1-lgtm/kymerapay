import {
  BRAND,
  type Paginated,
  type WalletDto,
  type WalletEntry,
  type WalletSummary,
} from '@app/shared';
import { prisma } from '../config/database.js';
import { toWalletDto, toWalletEntry } from '../mappers/wallet.mapper.js';
import { walletRepository } from '../repositories/wallet.repository.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString, ZERO } from '../utils/money.js';

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAND.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The last `days` calendar dates in Nairobi, oldest first, as YYYY-MM-DD. */
function lastDays(days: number, now = new Date()): string[] {
  return Array.from({ length: days }, (_, index) =>
    dayFormatter.format(new Date(now.getTime() - (days - 1 - index) * 86_400_000)),
  );
}

async function requireWallet(userId: string) {
  const wallet = await walletRepository.findByUserId(prisma, userId);
  if (!wallet) throw AppError.notFound('This account does not have a wallet.');
  return wallet;
}

export const walletService = {
  async getWallet(userId: string): Promise<WalletDto> {
    return toWalletDto(await requireWallet(userId));
  },

  async listEntries(
    userId: string,
    limit: number,
    cursor?: string,
  ): Promise<Paginated<WalletEntry>> {
    const wallet = await requireWallet(userId);
    if (cursor) {
      // A cursor must belong to the caller's own wallet.
      const owned = await prisma.ledgerEntry.count({ where: { id: cursor, walletId: wallet.id } });
      if (!owned) throw AppError.badRequest('Invalid cursor.');
    }
    const rows = await walletRepository.listEntries(prisma, wallet.id, limit + 1, cursor);
    const page = rows.slice(0, limit);
    return {
      items: page.map(toWalletEntry),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  },

  async getSummary(userId: string, periodDays = 30): Promise<WalletSummary> {
    const wallet = await requireWallet(userId);
    const rows = await walletRepository.dailyFlows(prisma, wallet.id, periodDays, BRAND.timezone);
    const byDay = new Map(rows.map((row) => [row.day, row]));

    let moneyIn = ZERO;
    let moneyOut = ZERO;
    let transactionCount = 0;
    const daily = lastDays(periodDays).map((date) => {
      const row = byDay.get(date);
      const dayIn = money(row?.moneyIn ?? 0);
      const dayOut = money(row?.moneyOut ?? 0);
      moneyIn = moneyIn.plus(dayIn);
      moneyOut = moneyOut.plus(dayOut);
      transactionCount += row?.count ?? 0;
      return { date, moneyIn: toAmountString(dayIn), moneyOut: toAmountString(dayOut) };
    });

    return {
      periodDays,
      moneyIn: toAmountString(moneyIn),
      moneyOut: toAmountString(moneyOut),
      net: toAmountString(moneyIn.minus(moneyOut)),
      transactionCount,
      daily,
    };
  },
};
