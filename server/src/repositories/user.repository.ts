import { looksLikePhone, normalizeKenyanPhone } from '@app/shared';
import type { DbClient } from '../config/database.js';

export type UniqueUserField = 'username' | 'email' | 'phone';

/** How a login identifier ("caleb@x.com", "0712…", "@caleb254") maps to a unique column. */
export function resolveLoginIdentifier(
  identifier: string,
): { field: UniqueUserField; value: string } | null {
  const trimmed = identifier.trim();
  if (trimmed.includes('@') && !trimmed.startsWith('@')) {
    return { field: 'email', value: trimmed.toLowerCase() };
  }
  if (looksLikePhone(trimmed)) {
    const phone = normalizeKenyanPhone(trimmed);
    return phone ? { field: 'phone', value: phone } : null;
  }
  return { field: 'username', value: trimmed.replace(/^@/, '').toLowerCase() };
}

export const userRepository = {
  findById(db: DbClient, id: string) {
    return db.user.findUnique({ where: { id } });
  },

  findByIdWithProfile(db: DbClient, id: string) {
    return db.user.findUnique({ where: { id }, include: { businessProfile: true } });
  },

  findByLoginIdentifier(db: DbClient, identifier: string) {
    const resolved = resolveLoginIdentifier(identifier);
    if (!resolved) return Promise.resolve(null);
    switch (resolved.field) {
      case 'email':
        return db.user.findUnique({ where: { email: resolved.value } });
      case 'phone':
        return db.user.findUnique({ where: { phone: resolved.value } });
      case 'username':
        return db.user.findUnique({ where: { username: resolved.value } });
    }
  },

  /** Which of the given unique values are already registered. */
  async findTakenFields(
    db: DbClient,
    values: { username: string; email: string; phone: string },
  ): Promise<UniqueUserField[]> {
    const matches = await db.user.findMany({
      where: {
        OR: [{ username: values.username }, { email: values.email }, { phone: values.phone }],
      },
      select: { username: true, email: true, phone: true },
    });
    const taken = new Set<UniqueUserField>();
    for (const match of matches) {
      if (match.username === values.username) taken.add('username');
      if (match.email === values.email) taken.add('email');
      if (match.phone === values.phone) taken.add('phone');
    }
    return [...taken];
  },
};
