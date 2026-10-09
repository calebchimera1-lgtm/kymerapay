import type { PublicProfile } from '@app/shared';
import { BadgeCheck, Store } from 'lucide-react';
import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';

/** Name + @username for a person or business. Never shows contact details. */
export function ProfileRow({
  profile,
  trailing,
}: {
  profile: PublicProfile;
  trailing?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar name={profile.displayName} src={profile.avatarUrl} />
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1 truncate text-sm font-semibold">
          <span className="truncate">{profile.displayName}</span>
          {profile.kind === 'business' &&
            (profile.isVerified ? (
              <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified business" />
            ) : (
              <Store className="size-3.5 shrink-0 text-fg-muted" aria-label="Business" />
            ))}
        </span>
        <span className="block truncate text-xs text-fg-muted">@{profile.username}</span>
      </span>
      {trailing}
    </span>
  );
}
