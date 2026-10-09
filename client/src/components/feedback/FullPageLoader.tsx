import { LogoMark } from '@/components/brand/Logo';
import { Spinner } from '@/components/ui/Spinner';

/** Shown while the stored session is restored on page load. */
export function FullPageLoader({ label = 'Loading your wallet…' }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 text-fg-muted">
      <LogoMark className="size-12 animate-pulse" />
      <div className="flex items-center gap-2 text-sm">
        <Spinner className="text-primary" label={label} />
        <span aria-hidden="true">{label}</span>
      </div>
    </div>
  );
}
