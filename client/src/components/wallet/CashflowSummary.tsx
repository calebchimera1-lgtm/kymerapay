import { formatMoney } from '@app/shared';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Skeleton } from '@/components/feedback/LoadingState';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useWalletSummary } from '@/hooks/useWallet';
import { toApiClientError } from '@/services/api';
import { useUiStore } from '@/store/uiStore';

// The charting library is large; load it only when a chart is actually shown.
const CashflowChart = lazy(() =>
  import('./CashflowChart').then((module) => ({ default: module.CashflowChart })),
);

/** 30-day money in / out tiles plus the daily chart. */
export function CashflowSummary() {
  const summary = useWalletSummary();
  const hidden = useUiStore((state) => state.hideBalances);
  const show = (amount: string) => (hidden ? 'KSh ••••' : formatMoney(amount));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Last 30 days</CardTitle>
        {summary.data && (
          <span className="text-xs text-fg-muted">
            {summary.data.transactionCount} transaction
            {summary.data.transactionCount === 1 ? '' : 's'}
          </span>
        )}
      </CardHeader>
      <CardBody className="space-y-5">
        {summary.isPending ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
            <Skeleton className="h-52" />
          </div>
        ) : summary.isError ? (
          <ErrorState
            message={toApiClientError(summary.error).message}
            onRetry={() => void summary.refetch()}
            retrying={summary.isFetching}
          />
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted p-4 sm:block">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <ArrowDownLeft className="size-3.5" aria-hidden="true" /> Money in
                </dt>
                <dd className="text-lg font-bold tabular-nums sm:mt-1 sm:text-xl">
                  {show(summary.data.moneyIn)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-muted p-4 sm:block">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
                  <ArrowUpRight className="size-3.5" aria-hidden="true" /> Money out
                </dt>
                <dd className="text-lg font-bold tabular-nums sm:mt-1 sm:text-xl">
                  {show(summary.data.moneyOut)}
                </dd>
              </div>
            </dl>
            {!hidden && (
              <Suspense fallback={<Skeleton className="h-60" />}>
                <CashflowChart summary={summary.data} />
              </Suspense>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
