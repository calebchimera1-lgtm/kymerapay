import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { RequestList } from '@/components/requests/RequestList';
import { Card, CardBody } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { EntryList } from '@/components/wallet/EntryList';
import { useRequestSummary } from '@/hooks/useRequests';

type View = 'received' | 'requests';

export function BusinessPaymentsPage() {
  const [view, setView] = useState<View>('received');
  const summary = useRequestSummary();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Payments"
        description="Money received, and payment requests you've sent to customers."
        actions={
          <Link
            to="/business/requests/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" /> Request payment
          </Link>
        }
      />
      <Tabs
        label="Payments view"
        value={view}
        onChange={setView}
        tabs={[
          { value: 'received', label: 'Received' },
          {
            value: 'requests',
            label: 'Requests',
            ...(summary.data ? { count: summary.data.outgoingPending } : {}),
          },
        ]}
      />
      <Card>
        <CardBody className="py-1">
          {view === 'received' ? (
            <EntryList />
          ) : (
            <RequestList
              direction="outgoing"
              empty={{
                title: 'No payment requests yet.',
                description: 'Request a payment and the customer pays it with one tap.',
              }}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
