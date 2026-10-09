import { formatMoney, type TransferResult } from '@app/shared';
import { CheckCircle2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { formatActivityTime } from '@/utils/dates';

interface TransferSuccessProps {
  result: TransferResult;
  onDone: () => void;
  onSendAgain: () => void;
}

export function TransferSuccess({ result, onDone, onSendAgain }: TransferSuccessProps) {
  const { transaction } = result;
  return (
    <div className="mx-auto max-w-md space-y-6 text-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 pt-4">
        <span className="inline-flex size-16 animate-rise-in items-center justify-center rounded-full bg-success-soft text-success">
          <CheckCircle2 className="size-9" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight">Payment sent</h1>
        <p className="text-fg-muted">
          {formatMoney(transaction.amount)} to {transaction.recipient.displayName}
        </p>
      </div>

      <Card>
        <CardBody>
          <dl className="space-y-3 text-left text-sm">
            <Row
              label="To"
              value={`${transaction.recipient.displayName} (@${transaction.recipient.username})`}
            />
            <Row label="Amount" value={formatMoney(transaction.amount)} strong />
            {transaction.note && <Row label="Note" value={transaction.note} />}
            <Row
              label="Reference"
              value={<span className="font-mono">{transaction.reference}</span>}
            />
            <Row label="Date" value={formatActivityTime(transaction.createdAt)} />
            <Row label="Status" value="Completed" />
            <Row label="New balance" value={formatMoney(result.balance)} />
          </dl>
        </CardBody>
      </Card>

      <p className="text-xs text-fg-muted">Demo transaction — no real money was transferred.</p>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" size="lg" onClick={onSendAgain}>
          Send again
        </Button>
        <Button size="lg" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={strong ? 'font-bold tabular-nums' : 'text-right break-all'}>{value}</dd>
    </div>
  );
}
