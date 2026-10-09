import type { PublicProfile } from '@app/shared';
import type { BusinessProfile, User } from '../generated/prisma/client.js';

type ProfileSource = Pick<User, 'id' | 'username' | 'fullName' | 'avatarUrl' | 'role'> & {
  businessProfile: Pick<
    BusinessProfile,
    'businessName' | 'logoUrl' | 'category' | 'isVerified'
  > | null;
};

export const publicProfileSelect = {
  id: true,
  username: true,
  fullName: true,
  avatarUrl: true,
  role: true,
  businessProfile: {
    select: { businessName: true, logoUrl: true, category: true, isVerified: true },
  },
} as const;

/** Public identity only. Never phone, e-mail, balance or status. */
export function toPublicProfile(user: ProfileSource): PublicProfile {
  const business = user.businessProfile;
  return {
    id: user.id,
    kind: business ? 'business' : 'person',
    displayName: business?.businessName ?? user.fullName,
    username: user.username,
    avatarUrl: business?.logoUrl ?? user.avatarUrl,
    businessCategory: business?.category ?? null,
    isVerified: business?.isVerified ?? false,
  };
}
