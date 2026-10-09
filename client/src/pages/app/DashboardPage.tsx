import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { EntryList } from '@/components/wallet/EntryList';
import { useAuthStore } from '@/store/authStore';
import { greetingFor } from '@/utils/dates';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader title={`${greetingFor()}, ${firstName} 👋`} />
      <BalanceCard />
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <Link
            to="/app/wallet"
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
          >
            See all <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardBody className="pt-1">
          <EntryList limit={5} paginate={false} />
        </CardBody>
      </Card>
    </div>
  );
}
