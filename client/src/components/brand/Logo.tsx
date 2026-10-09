import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';

/** Brand mark: a beadwork-inspired diamond. Rebrand by replacing this SVG. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9', className)} aria-hidden="true">
      <rect width="64" height="64" rx="16" className="fill-primary" />
      <path
        d="M32 12 50 32 32 52 14 32Z"
        fill="none"
        className="stroke-primary-fg"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M32 24 40 32 32 40 24 32Z" className="fill-accent" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className="text-lg font-extrabold tracking-tight">{BRAND.name}</span>
    </span>
  );
}
