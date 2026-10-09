import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { CashflowSummary } from '@/components/wallet/CashflowSummary';
import { EntryList } from '@/components/wallet/EntryList';
import { useAuthStore } from '@/store/authStore';
import { greetingFor } from '@/utils/dates';

export function BusinessDashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor()} 👋`}
        description={user.business?.businessName ?? user.fullName}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="space-y-6">
          <BalanceCard showActions={false} />
          <CashflowSummary />
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
