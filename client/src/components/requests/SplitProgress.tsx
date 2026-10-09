import { formatMoney } from '@app/shared';

/** Paid vs. total as a labelled bar. Display only — amounts come from the server. */
export function SplitProgress({ paid, total }: { paid: string; total: string }) {
  const percent =
    Number(total) > 0 ? Math.min(100, Math.round((Number(paid) / Number(total)) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${formatMoney(paid)} of ${formatMoney(total)} collected`}
        className="h-2.5 overflow-hidden rounded-full bg-surface-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="flex justify-between text-xs text-fg-muted tabular-nums">
        <span>{formatMoney(paid)} collected</span>
        <span>{percent}%</span>
      </p>
    </div>
  );
}
