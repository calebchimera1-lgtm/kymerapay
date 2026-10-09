import { Wallet } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/Button';
import { useWalletEntries } from '@/hooks/useWallet';
import { toApiClientError } from '@/services/api';
import { EntryRow } from './EntryRow';

/** Wallet statement with loading, error, empty and paginated states. */
export function EntryList({ limit = 20, paginate = true }: { limit?: number; paginate?: boolean }) {
  const query = useWalletEntries(limit);

  if (query.isPending) {
    return (
      <ul aria-label="Loading activity" className="divide-y divide-border">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 py-3.5">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-20" />
          </li>
        ))}
      </ul>
    );
  }

  if (query.isError) {
    const error = toApiClientError(query.error);
    return (
      <ErrorState
        message={error.message}
        {...(error.requestId ? { requestId: error.requestId } : {})}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  const entries = query.data.pages.flatMap((page) => page.items);
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No transactions yet."
        description="Your wallet activity will appear here."
      />
    );
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {entries.map((entry) => (
          <EntryRow key={entry.id} entry={entry} />
        ))}
      </ul>
      {paginate && query.hasNextPage && (
        <div className="pt-3 text-center">
          <Button
            variant="secondary"
            size="sm"
            loading={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
