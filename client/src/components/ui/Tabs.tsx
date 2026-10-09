import { useRef } from 'react';
import { cn } from '@/utils/cn';

interface Tab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Accessible segmented tabs (arrow keys move between tabs). */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex rounded-2xl border border-border bg-surface p-1"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="tab"
          aria-selected={value === tab.value}
          tabIndex={value === tab.value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => {
            const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            if (!step) return;
            const next = (index + step + tabs.length) % tabs.length;
            onChange(tabs[next]!.value);
            refs.current[next]?.focus();
          }}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors',
            value === tab.value
              ? 'bg-primary-soft text-primary-soft-fg'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {tab.label}
          {tab.count ? (
            <span className="rounded-full bg-primary px-1.5 text-[11px] leading-5 text-primary-fg tabular-nums">
              {tab.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
