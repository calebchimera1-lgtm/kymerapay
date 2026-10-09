import type { AuthUser } from '@app/shared';
import type { BusinessProfile, User } from '../generated/prisma/client.js';

/**
 * The only shape in which an account leaves the API for its owner.
 * Hashes, lockout counters and token versions are deliberately omitted.
 */
export function toAuthUser(user: User & { businessProfile?: BusinessProfile | null }): AuthUser {
  const profile = user.businessProfile ?? null;
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    isDemo: user.isDemo,
    defaultVisibility: user.defaultVisibility,
    createdAt: user.createdAt.toISOString(),
    business: profile
      ? {
          id: profile.id,
          businessName: profile.businessName,
          category: profile.category,
          location: profile.location,
          description: profile.description,
          logoUrl: profile.logoUrl,
          isVerified: profile.isVerified,
        }
      : null,
  };
}
