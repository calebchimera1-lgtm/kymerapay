import { AlertCircle } from 'lucide-react';

/** Form-level error that isn't tied to a single field. Announced to screen readers. */
export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
