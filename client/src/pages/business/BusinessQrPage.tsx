import { formatMoney, normalizeAmount, type QrCodeDto } from '@app/shared';
import { Ban, Plus, Printer } from 'lucide-react';
import { useId, useState } from 'react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Skeleton } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmountField } from '@/components/payments/AmountField';
import { MyQrPanel } from '@/components/qr/MyQrPanel';
import { QrCard } from '@/components/qr/QrCard';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { useDynamicQrs, useGenerateQr, useRevokeQr } from '@/hooks/useQr';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { formatActivityTime } from '@/utils/dates';

const EXPIRY_CHOICES = [
  { minutes: 15, label: '15 min' },
  { minutes: 60, label: '1 hour' },
  { minutes: 1440, label: '24 hours' },
];

export function BusinessQrPage() {
  const user = useAuthStore((state) => state.user)!;
  const [creating, setCreating] = useState(false);
  const [shown, setShown] = useState<QrCodeDto | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Code"
        description="Print your shop QR, or create a one-time code for an exact amount."
        actions={
          <Button
            variant="secondary"
            className="print:hidden"
            onClick={() => window.print()}
            leftIcon={<Printer className="size-4" aria-hidden="true" />}
          >
            Print
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardBody className="py-8">
            <MyQrPanel size={240} />
          </CardBody>
        </Card>

        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Codes for an exact amount</CardTitle>
            <Button
              size="sm"
              onClick={() => setCreating(true)}
              leftIcon={<Plus className="size-4" aria-hidden="true" />}
            >
              New
            </Button>
          </CardHeader>
          <CardBody className="pt-2">
            <DynamicList onShow={setShown} />
          </CardBody>
        </Card>
      </div>

      <CreateDynamicDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(qr) => {
          setCreating(false);
          setShown(qr);
        }}
      />

      <Dialog
        open={shown !== null}
        onClose={() => setShown(null)}
        title={shown?.amount ? `Pay ${formatMoney(shown.amount)}` : 'Payment QR'}
        description={
          shown?.expiresAt
            ? `Single use · expires ${formatActivityTime(shown.expiresAt).toLowerCase()}`
            : undefined
        }
      >
        {shown && (
          <QrCard
            qr={shown}
            size={240}
            title={user.business?.businessName ?? user.fullName}
            subtitle={shown.note ?? `@${user.username}`}
          />
        )}
      </Dialog>
    </div>
  );
}

function DynamicList({ onShow }: { onShow: (qr: QrCodeDto) => void }) {
  const list = useDynamicQrs();
  const revoke = useRevokeQr();

  if (list.isPending) return <Skeleton className="h-24" />;
  if (list.isError)
    return (
      <ErrorState
        message={toApiClientError(list.error).message}
        onRetry={() => void list.refetch()}
      />
    );
  if (list.data.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="No active codes"
        description="Create a one-time QR for an exact amount — the customer can't change it, and it works once."
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {list.data.map((qr) => (
        <li key={qr.id} className="flex items-center gap-3 py-3">
          <button type="button" onClick={() => onShow(qr)} className="min-w-0 flex-1 text-left">
            <span className="block font-semibold tabular-nums">
              {formatMoney(qr.amount ?? '0')}
            </span>
            <span className="block truncate text-xs text-fg-muted">
              {qr.note ? `${qr.note} · ` : ''}expires{' '}
              {formatActivityTime(qr.expiresAt!).toLowerCase()}
            </span>
          </button>
          <Button variant="secondary" size="sm" onClick={() => onShow(qr)}>
            Show
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Cancel the ${formatMoney(qr.amount ?? '0')} code`}
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(qr.id)}
          >
            <Ban className="size-4" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

function CreateDynamicDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (qr: QrCodeDto) => void;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [minutes, setMinutes] = useState(15);
  const generate = useGenerateQr();
  const amountId = useId();
  const noteId = useId();
  const normalized = normalizeAmount(amount);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      dismissible={!generate.isPending}
      title="QR for an exact amount"
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!normalized) return;
          generate.mutate(
            {
              type: 'DYNAMIC',
              amount: normalized,
              expiresInMinutes: minutes,
              ...(note.trim() ? { note: note.trim() } : {}),
            },
            {
              onSuccess: (qr) => {
                setAmount('');
                setNote('');
                onCreated(qr);
              },
            },
          );
        }}
      >
        <div className="text-center">
          <label htmlFor={amountId} className="text-sm font-medium text-fg-muted">
            Amount
          </label>
          <AmountField id={amountId} value={amount} onChange={setAmount} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor={noteId} className="text-sm font-medium">
            Reference <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <input
            id={noteId}
            value={note}
            maxLength={140}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Invoice 42"
            className="h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium">Valid for</legend>
          <div className="grid grid-cols-3 gap-2">
            {EXPIRY_CHOICES.map((choice) => (
              <label
                key={choice.minutes}
                className={`flex h-11 cursor-pointer items-center justify-center rounded-xl border text-sm font-semibold ${
                  minutes === choice.minutes
                    ? 'border-primary bg-primary-soft text-primary-soft-fg'
                    : 'border-border'
                }`}
              >
                <input
                  type="radio"
                  name="expiry"
                  className="sr-only"
                  checked={minutes === choice.minutes}
                  onChange={() => setMinutes(choice.minutes)}
                />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
        <FormAlert message={generate.error ? toApiClientError(generate.error).message : null} />
        <Button
          type="submit"
          size="lg"
          fullWidth
          disabled={!normalized}
          loading={generate.isPending}
        >
          Create QR {normalized ? `for ${formatMoney(normalized)}` : ''}
        </Button>
      </form>
    </Dialog>
  );
}
