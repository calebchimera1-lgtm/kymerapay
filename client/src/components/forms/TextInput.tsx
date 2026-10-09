import type { InputHTMLAttributes, ReactNode, Ref } from 'react';
import { cn } from '@/utils/cn';
import { Field, inputClasses } from './Field';

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  /** Fixed text shown inside the field before the value, e.g. "@". */
  leading?: ReactNode;
  /** Element rendered inside the field on the right, e.g. a visibility toggle. */
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
  containerClassName?: string;
}

export function TextInput({
  label,
  error,
  hint,
  leading,
  trailing,
  className,
  containerClassName,
  ref,
  ...props
}: TextInputProps) {
  return (
    <Field label={label} error={error} hint={hint} className={containerClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-fg-muted">
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={inputClasses(invalid, cn(leading && 'pl-8', trailing && 'pr-12', className))}
            {...props}
          />
          {trailing && (
            <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>
          )}
        </div>
      )}
    </Field>
  );
}
