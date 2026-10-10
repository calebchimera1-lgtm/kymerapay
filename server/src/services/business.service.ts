import {
  BRAND,
  type BusinessAnalytics,
  type BusinessDashboard,
  type BusinessPublicProfile,
  type CustomerSummary,
  type PagedResult,
  type UpdateBusinessInput,
} from '@app/shared';
import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { publicProfileSelect, toPublicProfile } from '../mappers/profile.mapper.js';
import { toAuthUser } from '../mappers/user.mapper.js';
import { AppError } from '../utils/AppError.js';
import { money, toAmountString, ZERO } from '../utils/money.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { removeImage, storeImage } from './media.service.js';

/** Money a customer pays a business. Funding, adjustments and reversals are not sales. */
const SALE_TYPES = ['BUSINESS_PAYMENT', 'REQUEST_PAYMENT', 'SPLIT_PAYMENT', 'TRANSFER'];
const TZ = BRAND.timezone;

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

async function businessWallet(userId: string) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.type !== 'BUSINESS')
    throw AppError.forbidden('This is not a business account.');
  return wallet;
}

async function loadPublicBusiness(where: Prisma.UserWhereInput): Promise<BusinessPublicProfile> {
  const user = await prisma.user.findFirst({
    where: { ...where, role: 'BUSINESS', status: 'ACTIVE' },
    select: {
      ...publicProfileSelect,
      businessProfile: {
        select: {
          businessName: true,
          logoUrl: true,
          category: true,
          isVerified: true,
          location: true,
          description: true,
        },
      },
    },
  });
  if (!user?.businessProfile) throw AppError.notFound('Business not found.');
  return {
    ...toPublicProfile(user),
    kind: 'business',
    businessName: user.businessProfile.businessName,
    category: user.businessProfile.category,
    location: user.businessProfile.location,
    description: user.businessProfile.description,
  };
}

export const businessService = {
  getPublicByUsername(username: string) {
    return loadPublicBusiness({ username });
  },

  getPublicById(id: string) {
    return loadPublicBusiness({ id });
  },

  async dashboard(userId: string): Promise<BusinessDashboard> {
    const wallet = await businessWallet(userId);
    const [[today], [allTime], pending] = await Promise.all([
      prisma.$queryRaw<{ sales: Prisma.Decimal; count: number; customers: number }[]>`
        SELECT COALESCE(SUM(amount), 0) AS sales, COUNT(*)::int AS count, COUNT(DISTINCT from_wallet_id)::int AS customers
        FROM transactions
        WHERE to_wallet_id = ${wallet.id}::uuid AND status = 'COMPLETED' AND type::text = ANY(${SALE_TYPES})
          AND created_at >= (date_trunc('day', now() AT TIME ZONE ${TZ}) AT TIME ZONE ${TZ})`,
      prisma.$queryRaw<{ customers: number }[]>`
        SELECT COUNT(DISTINCT from_wallet_id)::int AS customers
        FROM transactions
        WHERE to_wallet_id = ${wallet.id}::uuid AND status = 'COMPLETED' AND type::text = ANY(${SALE_TYPES})`,
      prisma.paymentRequest.aggregate({
        where: { requesterId: userId, status: 'PENDING', expiresAt: { gt: new Date() } },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    return {
      today: {
        sales: toAmountString(today?.sales ?? 0),
        transactions: today?.count ?? 0,
        customers: today?.customers ?? 0,
      },
      totalCustomers: allTime?.customers ?? 0,
      pendingRequests: {
        count: pending._count,
        amount: toAmountString(pending._sum.amount ?? ZERO),
      },
      balance: toAmountString(wallet.balance),
    };
  },

  async analytics(userId: string, days: number): Promise<BusinessAnalytics> {
    const wallet = await businessWallet(userId);
    const [daily, [previous], top] = await Promise.all([
      prisma.$queryRaw<{ day: string; sales: Prisma.Decimal; count: number; customers: number }[]>`
        SELECT to_char((created_at AT TIME ZONE ${TZ})::date, 'YYYY-MM-DD') AS day,
               SUM(amount) AS sales, COUNT(*)::int AS count, COUNT(DISTINCT from_wallet_id)::int AS customers
        FROM transactions
        WHERE to_wallet_id = ${wallet.id}::uuid AND status = 'COMPLETED' AND type::text = ANY(${SALE_TYPES})
          AND created_at >= ((date_trunc('day', now() AT TIME ZONE ${TZ}) - make_interval(days => ${days - 1})) AT TIME ZONE ${TZ})
        GROUP BY day`,
      prisma.$queryRaw<{ sales: Prisma.Decimal | null }[]>`
        SELECT SUM(amount) AS sales
        FROM transactions
        WHERE to_wallet_id = ${wallet.id}::uuid AND status = 'COMPLETED' AND type::text = ANY(${SALE_TYPES})
          AND created_at >= ((date_trunc('day', now() AT TIME ZONE ${TZ}) - make_interval(days => ${2 * days - 1})) AT TIME ZONE ${TZ})
          AND created_at <  ((date_trunc('day', now() AT TIME ZONE ${TZ}) - make_interval(days => ${days - 1})) AT TIME ZONE ${TZ})`,
      prisma.$queryRaw<{ userId: string; total: Prisma.Decimal; count: number }[]>`
        SELECT w.user_id AS "userId", SUM(t.amount) AS total, COUNT(*)::int AS count
        FROM transactions t JOIN wallets w ON w.id = t.from_wallet_id
        WHERE t.to_wallet_id = ${wallet.id}::uuid AND t.status = 'COMPLETED' AND t.type::text = ANY(${SALE_TYPES})
          AND t.created_at >= ((date_trunc('day', now() AT TIME ZONE ${TZ}) - make_interval(days => ${days - 1})) AT TIME ZONE ${TZ})
        GROUP BY w.user_id
        ORDER BY total DESC
        LIMIT 5`,
    ]);

    const [uniqueRow] = await prisma.$queryRaw<{ customers: number }[]>`
      SELECT COUNT(DISTINCT from_wallet_id)::int AS customers
      FROM transactions
      WHERE to_wallet_id = ${wallet.id}::uuid AND status = 'COMPLETED' AND type::text = ANY(${SALE_TYPES})
        AND created_at >= ((date_trunc('day', now() AT TIME ZONE ${TZ}) - make_interval(days => ${days - 1})) AT TIME ZONE ${TZ})`;

    const byDay = new Map(daily.map((row) => [row.day, row]));
    let total = ZERO;
    let count = 0;
    const now = Date.now();
    const series = Array.from({ length: days }, (_, index) => {
      const date = dayFormatter.format(new Date(now - (days - 1 - index) * 86_400_000));
      const row = byDay.get(date);
      total = total.plus(row?.sales ?? 0);
      count += row?.count ?? 0;
      return { date, sales: toAmountString(row?.sales ?? 0), transactions: row?.count ?? 0 };
    });

    const customers = await prisma.user.findMany({
      where: { id: { in: top.map((row) => row.userId) } },
      select: publicProfileSelect,
    });
    const byId = new Map(customers.map((user) => [user.id, user]));

    return {
      periodDays: days,
      totalSales: toAmountString(total),
      previousPeriodSales: toAmountString(previous?.sales ?? 0),
      transactions: count,
      averageSale: toAmountString(count > 0 ? total.dividedBy(count).toDecimalPlaces(2) : 0),
      uniqueCustomers: uniqueRow?.customers ?? 0,
      daily: series,
      topCustomers: top
        .filter((row) => byId.has(row.userId))
        .map((row) => ({
          customer: toPublicProfile(byId.get(row.userId)!),
          total: toAmountString(row.total),
          payments: row.count,
        })),
    };
  },

  /** Everyone who has paid the business, most recent first. Public profile fields only. */
  async customers(
    userId: string,
    page: number,
    limit: number,
  ): Promise<PagedResult<CustomerSummary>> {
    const wallet = await businessWallet(userId);
    const [[counted], rows] = await Promise.all([
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(DISTINCT from_wallet_id)::int AS total
        FROM transactions
        WHERE to_wallet_id = ${wallet.id}::uuid AND status = 'COMPLETED' AND type::text = ANY(${SALE_TYPES})`,
      prisma.$queryRaw<{ userId: string; total: Prisma.Decimal; count: number; last: Date }[]>`
        SELECT w.user_id AS "userId", SUM(t.amount) AS total, COUNT(*)::int AS count, MAX(t.created_at) AS last
        FROM transactions t JOIN wallets w ON w.id = t.from_wallet_id
        WHERE t.to_wallet_id = ${wallet.id}::uuid AND t.status = 'COMPLETED' AND t.type::text = ANY(${SALE_TYPES})
        GROUP BY w.user_id
        ORDER BY last DESC, w.user_id
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    ]);

    const users = await prisma.user.findMany({
      where: { id: { in: rows.map((row) => row.userId) } },
      select: publicProfileSelect,
    });
    const byId = new Map(users.map((user) => [user.id, user]));
    const totalItems = counted?.total ?? 0;
    return {
      items: rows
        .filter((row) => byId.has(row.userId))
        .map((row) => ({
          customer: toPublicProfile(byId.get(row.userId)!),
          totalSpent: toAmountString(money(row.total)),
          payments: row.count,
          lastPaidAt: row.last.toISOString(),
        })),
      page,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    };
  },

  async updateProfile(userId: string, input: UpdateBusinessInput, context: RequestContext) {
    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) throw AppError.forbidden('This is not a business account.');
    const changes = input as Prisma.BusinessProfileUpdateInput & { businessName?: string };

    await runInTransaction(async (tx) => {
      await tx.businessProfile.update({ where: { userId }, data: changes });
      // The account's display name is the business name.
      if (changes.businessName)
        await tx.user.update({ where: { id: userId }, data: { fullName: changes.businessName } });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.BUSINESS_UPDATED,
        actorId: userId,
        entityType: 'business_profile',
        entityId: profile.id,
        context,
        metadata: { fields: Object.keys(changes) },
      });
    });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { businessProfile: true },
    });
    return toAuthUser(user);
  },

  async setLogo(userId: string, file: Buffer, context: RequestContext) {
    const profile = await prisma.businessProfile.findUnique({ where: { userId } });
    if (!profile) throw AppError.forbidden('This is not a business account.');
    const url = await storeImage('logos', file);
    await runInTransaction(async (tx) => {
      await tx.businessProfile.update({ where: { userId }, data: { logoUrl: url } });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.IMAGE_UPLOADED,
        actorId: userId,
        entityType: 'business_logo',
        entityId: profile.id,
        context,
      });
    });
    await removeImage(profile.logoUrl);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { businessProfile: true },
    });
    return toAuthUser(user);
  },
};
