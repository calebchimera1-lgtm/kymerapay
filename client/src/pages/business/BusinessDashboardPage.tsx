import { formatMoney } from '@app/shared';
import { ArrowRight, Clock, Receipt, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LazySalesChart } from '@/components/business/LazySalesChart';
import { StatTile } from '@/components/business/StatTile';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { EntryList } from '@/components/wallet/EntryList';
import { useBusinessAnalytics, useBusinessDashboard } from '@/hooks/useBusiness';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { greetingFor } from '@/utils/dates';

export function BusinessDashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const dashboard = useBusinessDashboard();
  const week = useBusinessAnalytics(7);
  const loading = dashboard.isPending;
  const data = dashboard.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor()} 👋`}
        description={user.business?.businessName ?? user.fullName}
      />

      {dashboard.isError ? (
        <Card>
          <ErrorState
            message={toApiClientError(dashboard.error).message}
            onRetry={() => void dashboard.refetch()}
          />
        </Card>
      ) : (
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Today's Sales"
            icon={TrendingUp}
            loading={loading}
            value={data ? formatMoney(data.today.sales) : ''}
          />
          <StatTile
            label="Transactions"
            icon={Receipt}
            loading={loading}
            value={data?.today.transactions}
            hint="Today"
          />
          <StatTile
            label="Customers"
            icon={Users}
            loading={loading}
            value={data?.today.customers}
            hint={data ? `${data.totalCustomers} all time` : undefined}
          />
          <StatTile
            label="Pending Requests"
            icon={Clock}
            loading={loading}
            value={data ? formatMoney(data.pendingRequests.amount) : ''}
            hint={data ? `${data.pendingRequests.count} open` : undefined}
          />
        </dl>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="space-y-6">
          <BalanceCard showActions={false} />
          <Card>
            <CardHeader>
              <CardTitle>Sales · last 7 days</CardTitle>
              <Link
                to="/business/analytics"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
              >
                Analytics <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </CardHeader>
            <CardBody>
              {week.data ? (
                <LazySalesChart days={week.data.daily} title="Sales, last 7 days" />
              ) : week.isError ? (
                <ErrorState
                  message={toApiClientError(week.error).message}
                  onRetry={() => void week.refetch()}
                />
              ) : (
                <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
              )}
            </CardBody>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardBody className="pt-1">
            <EntryList limit={10} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
