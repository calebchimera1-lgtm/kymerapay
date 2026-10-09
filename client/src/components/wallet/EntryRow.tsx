import { formatMoney, TRANSACTION_TYPE_LABELS, type WalletEntry } from '@app/shared';
import { Landmark } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { formatActivityTime } from '@/utils/dates';

/** One statement line: who, what, when, how much. Direction is shown by sign and words, not colour alone. */
export function EntryRow({ entry }: { entry: WalletEntry }) {
  const hidden = useUiStore((state) => state.hideBalances);
  const incoming = entry.direction === 'CREDIT';
  const { counterparty } = entry;
  const action = incoming ? 'Received' : 'Sent';

  return (
    <li className="flex items-center gap-3 py-3.5">
      {counterparty.kind === 'system' ? (
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
          <Landmark className="size-5" aria-hidden="true" />
        </span>
      ) : (
        <Avatar name={counterparty.displayName} src={counterparty.avatarUrl} />
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{counterparty.displayName}</p>
        <p className="truncate text-xs text-fg-muted">
          {entry.type === 'FUNDING' ? TRANSACTION_TYPE_LABELS.FUNDING : action}
          {entry.note ? ` · ${entry.note}` : ''}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className={cn('text-sm font-bold tabular-nums', incoming ? 'text-success' : 'text-fg')}>
          <span className="sr-only">{action} </span>
          {hidden
            ? '••••'
            : formatMoney(incoming ? entry.amount : `-${entry.amount}`, { signed: true })}
        </p>
        <p className="text-xs text-fg-muted">{formatActivityTime(entry.createdAt)}</p>
      </div>
    </li>
  );
}
