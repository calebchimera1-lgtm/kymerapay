import type { AuthUser, UpdateProfileInput } from '@app/shared';
import { prisma } from '../config/database.js';
import { toAuthUser } from '../mappers/user.mapper.js';
import { AppError } from '../utils/AppError.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { removeImage, storeImage } from './media.service.js';

async function reload(userId: string): Promise<AuthUser> {
  return toAuthUser(
    await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { businessProfile: true },
    }),
  );
}

export const profileService = {
  async update(
    userId: string,
    input: UpdateProfileInput,
    context: RequestContext,
  ): Promise<AuthUser> {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true },
    });
    if (input.fullName && user.role === 'BUSINESS') {
      throw AppError.validation([
        { path: 'fullName', message: 'Change the business name in your business profile.' },
      ]);
    }
    await runInTransaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(input.fullName ? { fullName: input.fullName } : {}),
          ...(input.defaultVisibility ? { defaultVisibility: input.defaultVisibility } : {}),
        },
      });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.PROFILE_UPDATED,
        actorId: userId,
        entityType: 'user',
        entityId: userId,
        context,
        metadata: { fields: Object.keys(input) },
      });
    });
    return reload(userId);
  },

  async setAvatar(userId: string, file: Buffer, context: RequestContext): Promise<AuthUser> {
    const current = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    const url = await storeImage('avatars', file);
    await runInTransaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { avatarUrl: url } });
      await recordAudit(tx, {
        action: AUDIT_ACTIONS.IMAGE_UPLOADED,
        actorId: userId,
        entityType: 'avatar',
        entityId: userId,
        context,
      });
    });
    await removeImage(current.avatarUrl);
    return reload(userId);
  },

  async removeAvatar(userId: string): Promise<AuthUser> {
    const current = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } });
    await removeImage(current.avatarUrl);
    return reload(userId);
  },
};
