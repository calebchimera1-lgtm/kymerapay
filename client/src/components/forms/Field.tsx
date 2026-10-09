import { useId, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface FieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string;
  /** Renders the control, wired to the label, hint and error for screen readers. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + hint/error, with correct ARIA wiring. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const inputClasses = (invalid: boolean, extra?: string) =>
  cn(
    'h-12 w-full rounded-xl border bg-surface px-3.5 text-base text-fg placeholder:text-fg-subtle',
    'transition-[border-color,box-shadow] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15',
    'disabled:cursor-not-allowed disabled:opacity-60',
    invalid ? 'border-danger focus:border-danger focus:ring-danger/15' : 'border-border',
    extra,
  );
