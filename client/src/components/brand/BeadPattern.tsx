import { useId } from 'react';
import { cn } from '@/utils/cn';

/**
 * Subtle geometric motif inspired by East African beadwork. Purely decorative;
 * inherits `currentColor` so it adapts to any surface and theme.
 */
export function BeadPattern({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
      aria-hidden="true"
    >
      <defs>
        <pattern id={id} width="36" height="36" patternUnits="userSpaceOnUse">
          <path d="M18 4 26 12 18 20 10 12Z" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="18" cy="12" r="1.6" fill="currentColor" />
          <path d="M0 28h8M28 28h8" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="18" cy="28" r="1.2" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
