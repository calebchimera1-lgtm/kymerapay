import { formatMoney } from '@app/shared';
import { ChevronRight, Plus, Split } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { SplitProgress } from '@/components/requests/SplitProgress';
import { StatusBadge } from '@/components/requests/StatusBadge';
import { Card, CardBody } from '@/components/ui/Card';
import { useBillSplits } from '@/hooks/useRequests';
import { toApiClientError } from '@/services/api';
import { formatActivityTime } from '@/utils/dates';

const newSplitLink = (
  <Link
    to="/app/split/new"
    className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
  >
    <Plus className="size-4" aria-hidden="true" /> New split
  </Link>
);

export function SplitListPage() {
  const splits = useBillSplits();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Split bills"
        description="Share a bill fairly and track who has paid."
        actions={newSplitLink}
      />
      {splits.isPending ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
      ) : splits.isError ? (
        <Card>
          <ErrorState
            message={toApiClientError(splits.error).message}
            onRetry={() => void splits.refetch()}
          />
        </Card>
      ) : splits.data.length === 0 ? (
        <Card>
          <EmptyState
            icon={Split}
            title="No bill splits yet."
            description="Split a restaurant bill, rent or a group trip — everyone gets a request for their share."
            action={newSplitLink}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {splits.data.map((split) => (
            <li key={split.id}>
              <Link
                to={`/app/split/${split.id}`}
                className="block rounded-card focus-visible:outline-offset-4"
              >
                <Card className="transition-colors hover:border-border-strong">
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{split.title}</p>
                        <p className="text-xs text-fg-muted">
                          {split.isCreator ? 'You created' : `From @${split.creator.username}`} ·{' '}
                          {split.participants.length} people · {formatActivityTime(split.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <StatusBadge status={split.status} />
                        <ChevronRight className="size-4 text-fg-muted" aria-hidden="true" />
                      </div>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {formatMoney(split.totalAmount)}
                    </p>
                    <SplitProgress paid={split.amountPaid} total={split.totalAmount} />
                  </CardBody>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
