import { ChevronDown } from 'lucide-react';
import type { Ref, SelectHTMLAttributes } from 'react';
import { Field, inputClasses } from './Field';

interface SelectInputProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  options: readonly { value: string; label: string }[];
  placeholder?: string;
  ref?: Ref<HTMLSelectElement>;
}

export function SelectInput({
  label,
  error,
  hint,
  options,
  placeholder,
  ref,
  ...props
}: SelectInputProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            className={inputClasses(invalid, 'appearance-none pr-10')}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-fg-muted"
            aria-hidden="true"
          />
        </div>
      )}
    </Field>
  );
}
