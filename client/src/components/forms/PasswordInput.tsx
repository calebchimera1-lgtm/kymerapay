import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { TextInput, type TextInputProps } from './TextInput';

export function PasswordInput(props: Omit<TextInputProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}
