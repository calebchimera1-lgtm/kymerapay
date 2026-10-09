import {
  compareAmounts,
  formatMoney,
  normalizeAmount,
  type PublicProfile,
  type TransferResult,
  type Visibility,
} from '@app/shared';
import { ArrowLeft, Lock, Users } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ErrorState } from '@/components/feedback/ErrorState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmountField } from '@/components/payments/AmountField';
import { ConfirmTransferDialog } from '@/components/payments/ConfirmTransferDialog';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { RecipientPicker } from '@/components/payments/RecipientPicker';
import { TransferSuccess } from '@/components/payments/TransferSuccess';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { usePublicConfig } from '@/hooks/useSystemStatus';
import { usePublicProfile, useSendMoney } from '@/hooks/useTransfers';
import { useWallet } from '@/hooks/useWallet';
import { ApiClientError, toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import { newIdempotencyKey } from '@/utils/idempotency';

const NOTE_MAX = 140;

/** Errors where the outcome is unknown (lost connection, server error): retry with the same key. */
function isUncertain(error: ApiClientError): boolean {
  return error.status === 0 || error.status >= 500;
}

export function SendMoneyPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const prefill = params.get('to');
  const defaultVisibility = useAuthStore((state) => state.user?.defaultVisibility ?? 'PRIVATE');

  const [chosen, setChosen] = useState<PublicProfile | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<Visibility>(defaultVisibility);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);
  const attempt = useRef<{ signature: string; key: string } | null>(null);

  // A `?to=username` deep link (e.g. from a QR code) pre-selects the recipient.
  const prefilled = usePublicProfile(chosen ? null : prefill);
  const recipient = chosen ?? prefilled.data ?? null;

  function setRecipient(profile: PublicProfile | null) {
    setChosen(profile);
    if (!profile && prefill) setParams({}, { replace: true });
  }

  const send = useSendMoney();
  const error = send.error ? toApiClientError(send.error) : null;

  function reset() {
    setRecipient(null);
    setAmount('');
    setNote('');
    setVisibility(defaultVisibility);
    setResult(null);
    attempt.current = null;
    send.reset();
    if (prefill) setParams({}, { replace: true });
  }

  if (result) {
    return (
      <TransferSuccess result={result} onDone={() => void navigate('/app')} onSendAgain={reset} />
    );
  }

  if (!recipient) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Send money" description="Who are you paying?" />
        {prefill && prefilled.isPending ? (
          <LoadingState label="Finding recipient…" />
        ) : prefill && prefilled.isError ? (
          <ErrorState
            title="Recipient not found"
            message={`We couldn't find @${prefill}. Search for someone else below.`}
            className="mb-6"
          />
        ) : null}
        <RecipientPicker onSelect={setRecipient} />
      </div>
    );
  }

  const normalized = normalizeAmount(amount);
  const isBusiness = recipient.kind === 'business';
  const effectiveVisibility: Visibility = isBusiness ? 'PRIVATE' : visibility;

  function openConfirm(normalizedAmount: string) {
    const signature = [
      recipient!.username,
      normalizedAmount,
      note.trim(),
      effectiveVisibility,
    ].join('|');
    // Same payment details → same key, so a retry can never pay twice.
    if (attempt.current?.signature !== signature) {
      attempt.current = { signature, key: newIdempotencyKey() };
    }
    send.reset();
    setConfirming(true);
  }

  function confirm(pin: string) {
    if (!normalized || !attempt.current) return;
    send.mutate(
      {
        input: {
          recipient: recipient!.username,
          amount: normalized,
          ...(note.trim() ? { note: note.trim() } : {}),
          visibility: effectiveVisibility,
          pin,
        },
        idempotencyKey: attempt.current.key,
      },
      {
        onSuccess: (transfer) => {
          setConfirming(false);
          setResult(transfer);
        },
      },
    );
  }

  const confirmError =
    error && isUncertain(error)
      ? new ApiClientError(
          error.code,
          "We couldn't confirm the payment. Try again — you won't be charged twice.",
          error.status,
        )
      : error;

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Send money" />
      <AmountStep
        recipient={recipient}
        amount={amount}
        onAmountChange={setAmount}
        note={note}
        onNoteChange={setNote}
        visibility={effectiveVisibility}
        onVisibilityChange={isBusiness ? undefined : setVisibility}
        onChangeRecipient={() => setRecipient(null)}
        onContinue={openConfirm}
      />
      {normalized && (
        <ConfirmTransferDialog
          open={confirming}
          recipient={recipient}
          amount={normalized}
          note={note.trim()}
          pending={send.isPending}
          error={confirmError}
          onCancel={() => setConfirming(false)}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}

interface AmountStepProps {
  recipient: PublicProfile;
  amount: string;
  onAmountChange: (value: string) => void;
  note: string;
  onNoteChange: (value: string) => void;
  visibility: Visibility;
  onVisibilityChange: ((value: Visibility) => void) | undefined;
  onChangeRecipient: () => void;
  onContinue: (normalizedAmount: string) => void;
}

function AmountStep({
  recipient,
  amount,
  onAmountChange,
  note,
  onNoteChange,
  visibility,
  onVisibilityChange,
  onChangeRecipient,
  onContinue,
}: AmountStepProps) {
  const amountId = useId();
  const hintId = useId();
  const noteId = useId();
  const wallet = useWallet();
  const config = usePublicConfig();
  const normalized = normalizeAmount(amount);

  // Client-side checks are hints for a smooth UX; the server re-validates everything.
  let problem: string | null = null;
  if (amount && !normalized) problem = 'Enter a valid amount.';
  else if (normalized && config.data) {
    const { minAmount, maxAmount } = config.data.limits;
    if (compareAmounts(normalized, minAmount) < 0)
      problem = `The minimum is ${formatMoney(minAmount)}.`;
    else if (compareAmounts(normalized, maxAmount) > 0)
      problem = `The maximum per payment is ${formatMoney(maxAmount)}.`;
  }
  if (
    !problem &&
    normalized &&
    wallet.data &&
    compareAmounts(normalized, wallet.data.balance) > 0
  ) {
    problem = `You only have ${formatMoney(wallet.data.balance)} available.`;
  }
  const canContinue = Boolean(normalized && !problem && compareAmounts(normalized, '0') > 0);

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (canContinue && normalized) onContinue(normalized);
      }}
    >
      <Card>
        <CardBody className="flex items-center justify-between gap-3">
          <ProfileRow profile={recipient} />
          <Button
            variant="ghost"
            size="sm"
            onClick={onChangeRecipient}
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
          onChange={onAmountChange}
          invalid={Boolean(problem)}
          describedBy={hintId}
        />
        <p
          id={hintId}
          className={cn('text-sm', problem ? 'font-medium text-danger' : 'text-fg-muted')}
          aria-live="polite"
        >
          {problem ?? (wallet.data ? `Available: ${formatMoney(wallet.data.balance)}` : ' ')}
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor={noteId} className="text-sm font-medium">
            What's it for? <span className="font-normal text-fg-muted">(optional)</span>
          </label>
          <span className="text-xs text-fg-muted tabular-nums" aria-hidden="true">
            {note.length}/{NOTE_MAX}
          </span>
        </div>
        <input
          id={noteId}
          value={note}
          maxLength={NOTE_MAX}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Lunch 😂"
          className="h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
      </div>

      {onVisibilityChange && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Who can see this payment?</legend>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { value: 'PRIVATE', label: 'Only us', hint: 'You and the recipient', Icon: Lock },
                {
                  value: 'FRIENDS',
                  label: 'Friends',
                  hint: 'Mutual contacts (no amount)',
                  Icon: Users,
                },
              ] as const
            ).map(({ value, label, hint, Icon }) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
                  visibility === value
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface',
                )}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  checked={visibility === value}
                  onChange={() => onVisibilityChange(value)}
                  className="sr-only"
                />
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-fg-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Button type="submit" size="lg" fullWidth disabled={!canContinue}>
        Continue
      </Button>
    </form>
  );
}
