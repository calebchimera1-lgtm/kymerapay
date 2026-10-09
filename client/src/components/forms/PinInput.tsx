import { TextInput, type TextInputProps } from './TextInput';

/** 4-digit, masked numeric PIN field with the numeric keypad on mobile. */
export function PinInput(props: Omit<TextInputProps, 'type' | 'inputMode' | 'maxLength'>) {
  return (
    <TextInput
      type="password"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={4}
      autoComplete="off"
      className="text-center text-xl tracking-[0.6em] tabular-nums"
      {...props}
    />
  );
}
