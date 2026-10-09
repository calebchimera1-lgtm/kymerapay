import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { CashflowSummary } from '@/components/wallet/CashflowSummary';
import { EntryList } from '@/components/wallet/EntryList';

export function WalletPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Wallet" description="Your simulated KES balance and statement." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
        <div className="space-y-6">
          <BalanceCard showActions={false} />
          <CashflowSummary />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Statement</CardTitle>
          </CardHeader>
          <CardBody className="pt-1">
            <EntryList />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
