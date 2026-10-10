import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/components/feedback/LoadingState';
import { cn } from '@/utils/cn';

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: ReactNode;
  loading?: boolean;
  className?: string;
}

/** One headline number: label, value, optional context line. Values use text tokens, not series colours. */
export function StatTile({ label, value, icon: Icon, hint, loading, className }: StatTileProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-border bg-surface p-4 shadow-card sm:p-5',
        className,
      )}
    >
      <dt className="flex items-center gap-2 text-xs font-medium text-fg-muted sm:text-sm">
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-2">
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <span className="block text-xl font-extrabold tracking-tight tabular-nums sm:text-2xl">
            {value}
          </span>
        )}
        {hint && !loading && <span className="mt-1 block text-xs text-fg-muted">{hint}</span>}
      </dd>
    </div>
  );
}
