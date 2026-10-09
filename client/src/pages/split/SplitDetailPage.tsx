import { formatMoney } from '@app/shared';
import { ArrowLeft, Ban } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormAlert } from '@/components/feedback/FormAlert';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { SplitProgress } from '@/components/requests/SplitProgress';
import { StatusBadge } from '@/components/requests/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { useBillSplit, useCancelSplit } from '@/hooks/useRequests';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { formatActivityTime } from '@/utils/dates';

export function SplitDetailPage() {
  const { id = '' } = useParams();
  const split = useBillSplit(id);
  const cancel = useCancelSplit();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const me = useAuthStore((state) => state.user?.username);

  if (split.isPending) return <LoadingState label="Loading bill split…" />;
  if (split.isError) {
    const error = toApiClientError(split.error);
    return (
      <ErrorState
        title={error.status === 404 ? 'Bill split not found' : undefined}
        message={error.message}
      />
    );
  }

  const data = split.data;
  const mine = data.participants.find((p) => p.user.username === me);
  const unpaidCount = data.participants.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        to="/app/split"
        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All splits
      </Link>
      <PageHeader
        title={data.title}
        description={`${data.isCreator ? 'You' : `@${data.creator.username}`} split this ${formatActivityTime(data.createdAt).toLowerCase()}`}
        actions={<StatusBadge status={data.status} />}
      />

      <Card>
        <CardBody className="space-y-4">
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Total" value={formatMoney(data.totalAmount)} />
            <Stat label="Paid" value={formatMoney(data.amountPaid)} />
            <Stat label="Remaining" value={formatMoney(data.amountRemaining)} />
          </dl>
          <SplitProgress paid={data.amountPaid} total={data.totalAmount} />
          {data.note && <p className="text-sm text-fg-muted">“{data.note}”</p>}
        </CardBody>
      </Card>

      {mine && mine.status === 'PENDING' && !data.isCreator && (
        <Card className="border-primary/40 bg-primary-soft">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-primary-soft-fg">
              Your share: {formatMoney(mine.amountOwed)}
            </p>
            <Link
              to="/app/requests"
              className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
            >
              Pay your share
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {data.participants.length} people ·{' '}
            {data.method === 'EQUAL' ? 'split equally' : 'custom amounts'}
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          <ul className="divide-y divide-border">
            {data.participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <ProfileRow profile={participant.user} />
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-bold tabular-nums">
                    {formatMoney(participant.amountOwed)}
                  </span>
                  <StatusBadge status={participant.status} />
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {data.isCreator && data.status === 'OPEN' && (
        <Button
          variant="secondary"
          className="text-danger"
          leftIcon={<Ban className="size-4" aria-hidden="true" />}
          onClick={() => setConfirmCancel(true)}
        >
          Cancel split
        </Button>
      )}

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        dismissible={!cancel.isPending}
        title="Cancel this bill split?"
        description={`${unpaidCount} unpaid ${unpaidCount === 1 ? 'request' : 'requests'} will be cancelled. Shares already paid stay paid.`}
      >
        <FormAlert message={cancel.error ? toApiClientError(cancel.error).message : null} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setConfirmCancel(false)}
            disabled={cancel.isPending}
          >
            Keep it
          </Button>
          <Button
            variant="danger"
            size="lg"
            loading={cancel.isPending}
            onClick={() => cancel.mutate(id, { onSuccess: () => setConfirmCancel(false) })}
          >
            Cancel split
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-muted px-2 py-3">
      <dt className="text-xs text-fg-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-bold tabular-nums sm:text-base">{value}</dd>
    </div>
  );
}
