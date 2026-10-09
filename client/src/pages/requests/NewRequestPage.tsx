import {
  formatMoney,
  normalizeAmount,
  compareAmounts,
  type PaymentRequestDto,
  type PublicProfile,
} from '@app/shared';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormAlert } from '@/components/feedback/FormAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmountField } from '@/components/payments/AmountField';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { RecipientPicker } from '@/components/payments/RecipientPicker';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { useCreateRequest } from '@/hooks/useRequests';
import { usePublicConfig } from '@/hooks/useSystemStatus';
import { toApiClientError } from '@/services/api';
import { cn } from '@/utils/cn';

export function NewRequestPage() {
  const navigate = useNavigate();
  const [payer, setPayer] = useState<PublicProfile | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [created, setCreated] = useState<PaymentRequestDto | null>(null);
  const create = useCreateRequest();
  const config = usePublicConfig();
  const amountId = useId();
  const hintId = useId();
  const noteId = useId();

  if (created) {
    return (
      <div className="mx-auto max-w-md space-y-6 pt-6 text-center" role="status">
        <span className="mx-auto inline-flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-9" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Request sent</h1>
        <p className="text-fg-muted">
          You requested {formatMoney(created.amount)} from @{created.counterparty.username}. We'll
          let you know when they respond.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => void navigate('/app/requests?tab=sent')}
          >
            View requests
          </Button>
          <Button size="lg" onClick={() => void navigate('/app')}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  if (!payer) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Request money" description="Who should pay you?" />
        {/* Only personal accounts can be asked to pay. */}
        <RecipientPicker onSelect={setPayer} accept={(profile) => profile.kind === 'person'} />
      </div>
    );
  }

  const normalized = normalizeAmount(amount);
  let problem: string | null = amount && !normalized ? 'Enter a valid amount.' : null;
  if (!problem && normalized && config.data) {
    const { minAmount, maxAmount } = config.data.limits;
    if (compareAmounts(normalized, minAmount) < 0)
      problem = `The minimum is ${formatMoney(minAmount)}.`;
    else if (compareAmounts(normalized, maxAmount) > 0)
      problem = `The maximum is ${formatMoney(maxAmount)}.`;
  }
  const canSubmit = Boolean(normalized && !problem) && !create.isPending;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Request money" />
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || !normalized) return;
          create.mutate(
            {
              payer: payer.username,
              amount: normalized,
              ...(note.trim() ? { note: note.trim() } : {}),
            },
            { onSuccess: setCreated },
          );
        }}
      >
        <Card>
          <CardBody className="flex items-center justify-between gap-3">
            <ProfileRow profile={payer} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPayer(null)}
              leftIcon={<ArrowLeft className="size-4" aria-hidden="true" />}
            >
              Change
            </Button>
          </CardBody>
        </Card>

        <div className="space-y-2 py-4 text-center">
          <AmountField
            id={amountId}
            value={amount}
            onChange={setAmount}
            invalid={Boolean(problem)}
            describedBy={hintId}
          />
          <p
            id={hintId}
            className={cn('text-sm', problem ? 'font-medium text-danger' : 'text-fg-muted')}
            aria-live="polite"
          >
            {problem ?? `@${payer.username} will be asked to pay this amount.`}
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={noteId} className="text-sm font-medium">
            What's it for? <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <input
            id={noteId}
            value={note}
            maxLength={140}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Internet bill"
            className="h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
        </div>

        <FormAlert message={create.error ? toApiClientError(create.error).message : null} />
        <Button type="submit" size="lg" fullWidth disabled={!canSubmit} loading={create.isPending}>
          Request {normalized && !problem ? formatMoney(normalized) : 'money'}
        </Button>
        <p className="text-center text-xs text-fg-muted">
          Requests expire after 7 days if not answered.
        </p>
      </form>
    </div>
  );
}
