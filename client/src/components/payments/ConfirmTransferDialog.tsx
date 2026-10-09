import { ERROR_CODES, formatMoney, type PublicProfile } from '@app/shared';
import { ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { FormAlert } from '@/components/feedback/FormAlert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import type { ApiClientError } from '@/services/api';
import { ProfileRow } from './ProfileRow';

interface ConfirmTransferDialogProps {
  open: boolean;
  recipient: PublicProfile;
  amount: string;
  note: string;
  pending: boolean;
  error: ApiClientError | null;
  onCancel: () => void;
  onConfirm: (pin: string) => void;
}

const PIN_ERRORS: ReadonlySet<string> = new Set([ERROR_CODES.INVALID_PIN, ERROR_CODES.PIN_LOCKED]);

/** "Send KSh 1,500.00 to @john254?" — the last step before money moves. Requires the PIN. */
export function ConfirmTransferDialog({
  open,
  recipient,
  amount,
  note,
  pending,
  error,
  onCancel,
  onConfirm,
}: ConfirmTransferDialogProps) {
  const [pin, setPin] = useState('');
  const pinId = useId();
  const pinErrorId = useId();
  const pinError = error && PIN_ERRORS.has(error.code) ? error.message : null;
  const formError = error && !PIN_ERRORS.has(error.code) ? error.message : null;

  function cancel() {
    setPin('');
    onCancel();
  }

  return (
    <Dialog
      open={open}
      onClose={cancel}
      dismissible={!pending}
      title={`Send ${formatMoney(amount)} to @${recipient.username}?`}
      description="Simulated money only — no real funds move."
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!/^\d{4}$/.test(pin)) return;
          onConfirm(pin);
          // The PIN is never kept around; after a wrong PIN the next attempt starts empty.
          setPin('');
        }}
      >
        <div className="space-y-3 rounded-2xl bg-surface-muted p-4">
          <ProfileRow profile={recipient} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-sm">
            <dt className="text-fg-muted">Amount</dt>
            <dd className="text-right font-bold tabular-nums">{formatMoney(amount)}</dd>
            <dt className="text-fg-muted">Fee</dt>
            <dd className="text-right tabular-nums">{formatMoney('0.00')}</dd>
            {note && (
              <>
                <dt className="text-fg-muted">Note</dt>
                <dd className="truncate text-right">{note}</dd>
              </>
            )}
          </dl>
        </div>

        <FormAlert message={formError} />

        <div className="space-y-1.5">
          <label htmlFor={pinId} className="flex items-center gap-1.5 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Enter your 4-digit
            PIN
          </label>
          <input
            id={pinId}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-invalid={pinError ? true : undefined}
            aria-describedby={pinError ? pinErrorId : undefined}
            className="h-14 w-full rounded-xl border border-border bg-surface text-center text-2xl tracking-[0.8em] tabular-nums outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 aria-[invalid]:border-danger"
          />
          {pinError && (
            <p id={pinErrorId} className="text-xs font-medium text-danger">
              {pinError}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="px-3"
            onClick={cancel}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="px-3 whitespace-nowrap"
            loading={pending}
            disabled={pin.length !== 4 && !pending}
          >
            Confirm Payment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
