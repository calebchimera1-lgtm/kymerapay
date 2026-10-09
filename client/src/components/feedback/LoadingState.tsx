import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-10 text-fg-muted',
        className,
      )}
    >
      <Spinner className="text-primary" label={label} />
      <p className="text-sm">{label}</p>
    </div>
  );
}

/** Shimmer placeholder for content whose shape is known. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-surface-muted', className)}
    />
  );
}
