import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { toApiClientError } from '@/services/api';

/**
 * Maps server field errors (`error.details`) onto form fields. Returns the
 * message to show in a form-level alert when no field could take it.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): string | null {
  const apiError = toApiClientError(error);
  let mapped = false;
  for (const issue of apiError.details ?? []) {
    if ((fields as readonly string[]).includes(issue.path)) {
      setError(
        issue.path as Path<T>,
        { type: 'server', message: issue.message },
        { shouldFocus: !mapped },
      );
      mapped = true;
    }
  }
  return mapped ? null : apiError.message;
}
