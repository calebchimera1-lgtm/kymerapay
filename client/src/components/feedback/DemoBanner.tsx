import { ShieldAlert } from 'lucide-react';
import { BRAND } from '@/config/brand';

/**
 * Always-visible sandbox indicator. Deliberately not dismissible: every
 * screen must make it obvious that no real money is involved.
 */
export function DemoBanner() {
  return (
    <div
      role="note"
      aria-label="Demo environment notice"
      className="sticky top-0 z-50 bg-demo-bg text-demo-fg print:static"
    >
      <p className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-1.5 text-center text-xs font-bold tracking-wide">
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        <span>{BRAND.demo.bannerText}</span>
        <span className="hidden font-medium sm:inline">· {BRAND.demo.disclaimer}</span>
      </p>
    </div>
  );
}
