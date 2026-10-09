import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { EntryList } from '@/components/wallet/EntryList';
import { RequestList } from '@/components/requests/RequestList';
import { useRequestSummary } from '@/hooks/useRequests';
import { useAuthStore } from '@/store/authStore';
import { greetingFor } from '@/utils/dates';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader title={`${greetingFor()}, ${firstName} 👋`} />
      <BalanceCard />
      <PendingRequestsCard />
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

/** "@caleb254 requested KSh 2,000 [Pay] [Decline]" — only shown when something is waiting. */
function PendingRequestsCard() {
  const summary = useRequestSummary();
  const count = summary.data?.incomingPending ?? 0;
  if (count === 0) return null;
  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle>
          Requests for you <span className="text-fg-muted">({count})</span>
        </CardTitle>
        <Link
          to="/app/requests"
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
        >
          See all <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardBody className="py-1">
        <RequestList direction="incoming" status="PENDING" limit={3} paginate={false} />
      </CardBody>
    </Card>
  );
}
