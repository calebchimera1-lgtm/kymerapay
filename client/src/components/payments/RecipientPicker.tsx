import type { PublicProfile } from '@app/shared';
import { Search, UserX } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/LoadingState';
import { Avatar } from '@/components/ui/Avatar';
import { useRecentRecipients, useUserSearch } from '@/hooks/useTransfers';
import { toApiClientError } from '@/services/api';
import { ProfileRow } from './ProfileRow';

export function RecipientPicker({ onSelect }: { onSelect: (profile: PublicProfile) => void }) {
  const [term, setTerm] = useState('');
  const recent = useRecentRecipients();
  const results = useUserSearch(term);
  const searching = term.trim().replace(/^@/, '').length >= 2;

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-muted"
          aria-hidden="true"
        />
        <input
          type="search"
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search @username or name"
          aria-label="Search for a person or business"
          autoCapitalize="none"
          spellCheck={false}
          className="h-14 w-full rounded-2xl border border-border bg-surface pr-4 pl-12 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </div>

      {searching ? (
        <section aria-label="Search results" aria-live="polite">
          {results.isPending ? (
            <ResultSkeleton />
          ) : results.isError ? (
            <ErrorState
              message={toApiClientError(results.error).message}
              onRetry={() => void results.refetch()}
            />
          ) : results.data.length === 0 ? (
            <EmptyState
              icon={UserX}
              title="No one found"
              description="Check the username and try again."
            />
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
              {results.data.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(profile)}
                    className="w-full px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-surface-muted"
                  >
                    <ProfileRow profile={profile} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        recent.data &&
        recent.data.length > 0 && (
          <section aria-labelledby="recent-heading" className="space-y-3">
            <h2 id="recent-heading" className="text-sm font-semibold text-fg-muted">
              Recent
            </h2>
            <ul className="flex gap-4 overflow-x-auto pb-1">
              {recent.data.map((profile) => (
                <li key={profile.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelect(profile)}
                    className="flex w-16 flex-col items-center gap-1.5 rounded-xl p-1 text-center hover:bg-surface-muted"
                  >
                    <Avatar
                      name={profile.displayName}
                      src={profile.avatarUrl}
                      size="lg"
                      className="size-12 text-base"
                    />
                    <span className="w-full truncate text-xs font-medium">
                      {profile.displayName.split(' ')[0]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      )}
    </div>
  );
}

function ResultSkeleton() {
  return (
    <ul aria-label="Searching" className="space-y-3">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/5" />
          </div>
        </li>
      ))}
    </ul>
  );
}
