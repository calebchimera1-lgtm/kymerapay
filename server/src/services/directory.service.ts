import type { PublicProfile } from '@app/shared';
import { prisma } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import { publicProfileSelect, toPublicProfile } from '../mappers/profile.mapper.js';
import { AppError } from '../utils/AppError.js';

/** Accounts that can be found and paid. */
const PAYABLE = {
  role: { in: ['USER', 'BUSINESS'] },
  status: 'ACTIVE',
} satisfies Prisma.UserWhereInput;

/** LIKE wildcards in user input must match literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const directoryService = {
  /** Find people and businesses by username, name or business name. */
  async search(query: string, requesterId: string, limit = 10): Promise<PublicProfile[]> {
    const term = escapeLike(query.trim());
    const users = await prisma.user.findMany({
      where: {
        ...PAYABLE,
        id: { not: requesterId },
        OR: [
          { username: { startsWith: term.toLowerCase() } },
          { fullName: { contains: term, mode: 'insensitive' } },
          { businessProfile: { businessName: { contains: term, mode: 'insensitive' } } },
        ],
      },
      select: publicProfileSelect,
      orderBy: { username: 'asc' },
      take: limit,
    });
    return users.map(toPublicProfile);
  },

  async getByUsername(username: string): Promise<PublicProfile> {
    const user = await prisma.user.findFirst({
      where: { ...PAYABLE, username },
      select: publicProfileSelect,
    });
    if (!user) throw AppError.notFound('No account with that username.');
    return toPublicProfile(user);
  },
};
