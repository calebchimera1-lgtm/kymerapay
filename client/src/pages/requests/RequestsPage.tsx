import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { RequestList } from '@/components/requests/RequestList';
import { Card, CardBody } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { useRequestSummary } from '@/hooks/useRequests';

type Direction = 'incoming' | 'outgoing';

export function RequestsPage() {
  const [params, setParams] = useSearchParams();
  const [direction, setDirection] = useState<Direction>(
    params.get('tab') === 'sent' ? 'outgoing' : 'incoming',
  );
  const summary = useRequestSummary();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Requests"
        description="Ask friends to pay you back, and answer what they ask of you."
        actions={
          <Link
            to="/app/requests/new"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
          >
            <Plus className="size-4" aria-hidden="true" /> New request
          </Link>
        }
      />
      <Tabs
        label="Request direction"
        value={direction}
        onChange={(value) => {
          setDirection(value);
          setParams(value === 'outgoing' ? { tab: 'sent' } : {}, { replace: true });
        }}
        tabs={[
          {
            value: 'incoming',
            label: 'To pay',
            ...(summary.data ? { count: summary.data.incomingPending } : {}),
          },
          {
            value: 'outgoing',
            label: 'Sent',
            ...(summary.data ? { count: summary.data.outgoingPending } : {}),
          },
        ]}
      />
      <Card>
        <CardBody className="py-1">
          <RequestList
            key={direction}
            direction={direction}
            empty={
              direction === 'incoming'
                ? {
                    title: 'Nothing to pay.',
                    description: 'When someone requests money from you, it shows up here.',
                  }
                : {
                    title: 'No requests sent yet.',
                    description: 'Request money and track who has paid you back.',
                  }
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
