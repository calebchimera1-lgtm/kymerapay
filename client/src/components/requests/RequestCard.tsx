import { formatMoney, type PaymentRequestDto } from '@app/shared';
import { Check, Split, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { ConfirmPaymentDialog } from '@/components/payments/ConfirmPaymentDialog';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { Button } from '@/components/ui/Button';
import { usePayRequest, useRespondToRequest } from '@/hooks/useRequests';
import { ApiClientError, toApiClientError } from '@/services/api';
import { formatActivityTime } from '@/utils/dates';
import { newIdempotencyKey } from '@/utils/idempotency';
import { StatusBadge } from './StatusBadge';

/**
 * One payment request. Incoming + pending shows [Pay] [Decline]; outgoing +
 * pending shows [Cancel]. Paying goes through the same PIN confirmation as Send.
 */
export function RequestCard({ request }: { request: PaymentRequestDto }) {
  const [confirming, setConfirming] = useState(false);
  const key = useRef<string | null>(null);
  const pay = usePayRequest();
  const respond = useRespondToRequest();

  const pending = request.status === 'PENDING';
  const incoming = request.direction === 'incoming';
  const who = request.counterparty.username
    ? `@${request.counterparty.username}`
    : request.counterparty.displayName;
  const headline = incoming
    ? `${who} requested ${formatMoney(request.amount)}`
    : `You requested ${formatMoney(request.amount)} from ${who}`;

  const payError = pay.error ? toApiClientError(pay.error) : null;
  const shownError =
    payError && (payError.status === 0 || payError.status >= 500)
      ? new ApiClientError(
          payError.code,
          "We couldn't confirm the payment. Try again — you won't be charged twice.",
          payError.status,
        )
      : payError;
  const respondError = respond.error ? toApiClientError(respond.error).message : null;

  return (
    <li className="space-y-3 py-4">
      <div className="flex items-start justify-between gap-3">
        <ProfileRow profile={request.counterparty} />
        <StatusBadge status={request.status} />
      </div>
      <div className="space-y-1 pl-[3.25rem]">
        <p className="text-sm font-semibold">{headline}</p>
        {request.note && <p className="text-sm text-fg-muted">“{request.note}”</p>}
        <p className="flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
          <span>{formatActivityTime(request.createdAt)}</span>
          {request.billSplit && (
            <Link
              to={`/app/split/${request.billSplit.id}`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Split className="size-3.5" aria-hidden="true" /> {request.billSplit.title}
            </Link>
          )}
          {request.transactionReference && (
            <span className="font-mono">{request.transactionReference}</span>
          )}
        </p>
        {respondError && (
          <p role="alert" className="text-xs font-medium text-danger">
            {respondError}
          </p>
        )}

        {pending && (
          <div className="flex gap-2 pt-2">
            {incoming ? (
              <>
                <Button
                  size="sm"
                  leftIcon={<Check className="size-4" aria-hidden="true" />}
                  onClick={() => {
                    key.current ??= newIdempotencyKey();
                    pay.reset();
                    setConfirming(true);
                  }}
                >
                  Pay
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={respond.isPending}
                  leftIcon={<X className="size-4" aria-hidden="true" />}
                  onClick={() => respond.mutate({ id: request.id, action: 'decline' })}
                >
                  Decline
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                loading={respond.isPending}
                onClick={() => respond.mutate({ id: request.id, action: 'cancel' })}
              >
                Cancel request
              </Button>
            )}
          </div>
        )}
      </div>

      {incoming && pending && (
        <ConfirmPaymentDialog
          open={confirming}
          recipient={request.counterparty}
          title={`Pay ${formatMoney(request.amount)} to ${who}?`}
          amount={request.amount}
          note={request.note ?? ''}
          pending={pay.isPending}
          error={shownError}
          onCancel={() => setConfirming(false)}
          onConfirm={(pin) =>
            pay.mutate(
              { id: request.id, pin, idempotencyKey: key.current! },
              { onSuccess: () => setConfirming(false) },
            )
          }
        />
      )}
    </li>
  );
}
