import { formatMoney } from '@app/shared';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useCustomers } from '@/hooks/useBusiness';
import { toApiClientError } from '@/services/api';
import { formatActivityTime } from '@/utils/dates';

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const customers = useCustomers(page);
  const data = customers.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Everyone who has paid you. Contact details are never shared."
      />
      <Card>
        <CardBody className="py-2">
          {customers.isPending ? (
            <div className="space-y-4 py-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : customers.isError ? (
            <ErrorState
              message={toApiClientError(customers.error).message}
              onRetry={() => void customers.refetch()}
            />
          ) : data!.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No customers yet."
              description="When people pay you, they'll appear here."
            />
          ) : (
            <ul className="divide-y divide-border" aria-busy={customers.isFetching}>
              {data!.items.map((row) => (
                <li
                  key={row.customer.id}
                  className="flex flex-wrap items-center gap-3 py-3.5 sm:flex-nowrap"
                >
                  <div className="min-w-0 flex-1">
                    <ProfileRow profile={row.customer} />
                  </div>
                  <dl className="grid grid-cols-3 gap-4 text-right text-xs sm:w-80">
                    <div>
                      <dt className="text-fg-muted">Spent</dt>
                      <dd className="text-sm font-bold tabular-nums">
                        {formatMoney(row.totalSpent)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-fg-muted">Payments</dt>
                      <dd className="text-sm font-semibold tabular-nums">{row.payments}</dd>
                    </div>
                    <div>
                      <dt className="text-fg-muted">Last paid</dt>
                      <dd className="text-sm">
                        {formatActivityTime(row.lastPaidAt).split(',')[0]}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      {data && data.totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            leftIcon={<ChevronLeft className="size-4" aria-hidden="true" />}
          >
            Previous
          </Button>
          <span className="text-sm text-fg-muted">
            Page {data.page} of {data.totalPages} · {data.totalItems} customers
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight className="size-4" aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  );
}
