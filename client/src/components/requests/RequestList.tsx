import type { PaymentRequestStatus } from '@app/shared';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/Button';
import { usePaymentRequests } from '@/hooks/useRequests';
import { toApiClientError } from '@/services/api';
import { RequestCard } from './RequestCard';

interface RequestListProps {
  direction: 'incoming' | 'outgoing';
  status?: PaymentRequestStatus;
  limit?: number;
  paginate?: boolean;
  empty?: { title: string; description: string; action?: ReactNode };
}

export function RequestList({
  direction,
  status,
  limit = 20,
  paginate = true,
  empty,
}: RequestListProps) {
  const query = usePaymentRequests({ direction, ...(status ? { status } : {}), limit });

  if (query.isPending) {
    return (
      <div aria-label="Loading requests" className="space-y-4 py-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <ErrorState
        message={toApiClientError(query.error).message}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const items = query.data.pages.flatMap((page) => page.items);
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={empty?.title ?? 'No requests yet.'}
        description={empty?.description ?? 'Requests you send and receive will appear here.'}
        action={empty?.action}
      />
    );
  }

  return (
    <div>
      <ul className="divide-y divide-border">
        {items.map((request) => (
          <RequestCard key={request.id} request={request} />
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
