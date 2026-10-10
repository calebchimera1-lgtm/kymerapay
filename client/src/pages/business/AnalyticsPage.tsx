import { compareAmounts, formatMoney, subtractAmounts } from '@app/shared';
import { BarChart3, Receipt, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LazySalesChart } from '@/components/business/LazySalesChart';
import { StatTile } from '@/components/business/StatTile';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { useBusinessAnalytics } from '@/hooks/useBusiness';
import { toApiClientError } from '@/services/api';

type Period = '7' | '30' | '90';

/** "+12% vs previous 30 days" — direction in words and sign, not colour alone. */
function changeHint(current: string, previous: string, days: number): string {
  if (compareAmounts(previous, '0') === 0) return `No sales in the previous ${days} days`;
  const percent = Math.round((Number(subtractAmounts(current, previous)) / Number(previous)) * 100);
  return `${percent >= 0 ? '+' : ''}${percent}% vs previous ${days} days`;
}

export function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30');
  const days = Number(period);
  const analytics = useBusinessAnalytics(days);
  const data = analytics.data;
  const loading = analytics.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="How your sales are going."
        actions={
          <Tabs
            label="Period"
            value={period}
            onChange={setPeriod}
            tabs={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />

      {analytics.isError ? (
        <Card>
          <ErrorState
            message={toApiClientError(analytics.error).message}
            onRetry={() => void analytics.refetch()}
          />
        </Card>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy={analytics.isFetching}>
            <StatTile
              label="Total sales"
              icon={TrendingUp}
              loading={loading}
              value={data ? formatMoney(data.totalSales) : ''}
              hint={data ? changeHint(data.totalSales, data.previousPeriodSales, days) : undefined}
            />
            <StatTile
              label="Payments"
              icon={Receipt}
              loading={loading}
              value={data?.transactions}
            />
            <StatTile
              label="Average sale"
              icon={BarChart3}
              loading={loading}
              value={data ? formatMoney(data.averageSale) : ''}
            />
            <StatTile
              label="Customers"
              icon={Users}
              loading={loading}
              value={data?.uniqueCustomers}
            />
          </dl>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
            <Card>
              <CardHeader>
                <CardTitle>Sales per day</CardTitle>
              </CardHeader>
              <CardBody>
                {data ? (
                  <LazySalesChart days={data.daily} title={`Sales per day, last ${days} days`} />
                ) : (
                  <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top customers</CardTitle>
              </CardHeader>
              <CardBody className="pt-2">
                {data && data.topCustomers.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No customers yet"
                    description="Customers who pay you will show up here."
                  />
                ) : (
                  <ol className="divide-y divide-border">
                    {(data?.topCustomers ?? []).map((row, index) => (
                      <li key={row.customer.id} className="flex items-center gap-3 py-3">
                        <span className="w-5 text-sm font-semibold text-fg-muted tabular-nums">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <ProfileRow profile={row.customer} />
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold tabular-nums">{formatMoney(row.total)}</p>
                          <p className="text-xs text-fg-muted">
                            {row.payments} payment{row.payments === 1 ? '' : 's'}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
