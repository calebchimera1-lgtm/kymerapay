import type { Ref, TextareaHTMLAttributes } from 'react';
import { Field, inputClasses } from './Field';

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  ref?: Ref<HTMLTextAreaElement>;
}

export function TextArea({ label, error, hint, ref, ...props }: TextAreaProps) {
  return (
    <Field label={label} error={error} hint={hint}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={3}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={inputClasses(invalid, 'h-auto min-h-24 py-3 leading-relaxed')}
          {...props}
        />
      )}
    </Field>
  );
}
