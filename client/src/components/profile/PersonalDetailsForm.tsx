import { fullNameSchema, type Visibility } from '@app/shared';
import { Check, Lock, Users } from 'lucide-react';
import { useId, useState } from 'react';
import { FormAlert } from '@/components/feedback/FormAlert';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/Button';
import { useUpdateProfile } from '@/hooks/useBusiness';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';

/** Display name and the default audience for new payments. */
export function PersonalDetailsForm() {
  const user = useAuthStore((state) => state.user)!;
  const update = useUpdateProfile();
  const [fullName, setFullName] = useState(user.fullName);
  const [visibility, setVisibility] = useState<Visibility>(user.defaultVisibility);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const legendId = useId();
  const dirty = fullName.trim() !== user.fullName || visibility !== user.defaultVisibility;

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = fullNameSchema.safeParse(fullName);
        if (!parsed.success)
          return setNameError(parsed.error.issues[0]?.message ?? 'Enter your name.');
        setNameError(null);
        setSaved(false);
        update.mutate(
          {
            ...(parsed.data !== user.fullName ? { fullName: parsed.data } : {}),
            ...(visibility !== user.defaultVisibility ? { defaultVisibility: visibility } : {}),
          },
          { onSuccess: () => setSaved(true) },
        );
      }}
    >
      <FormAlert message={update.error ? toApiClientError(update.error).message : null} />
      <TextInput
        label="Full name"
        autoComplete="name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        error={nameError ?? undefined}
      />
      <fieldset aria-labelledby={legendId} className="space-y-2">
        <legend id={legendId} className="text-sm font-medium">
          Who sees your new payments by default?
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: 'PRIVATE', label: 'Only us', hint: 'You and the other person', Icon: Lock },
              {
                value: 'FRIENDS',
                label: 'Friends',
                hint: 'Mutual contacts, no amounts',
                Icon: Users,
              },
            ] as const
          ).map(({ value, label, hint, Icon }) => (
            <label
              key={value}
              className={cn(
                'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3',
                visibility === value ? 'border-primary bg-primary-soft' : 'border-border',
              )}
            >
              <input
                type="radio"
                name="defaultVisibility"
                className="sr-only"
                checked={visibility === value}
                onChange={() => setVisibility(value)}
              />
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-xs text-fg-muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={update.isPending} disabled={!dirty}>
          Save changes
        </Button>
        {saved && !dirty && (
          <span
            role="status"
            className="inline-flex items-center gap-1 text-sm font-medium text-success"
          >
            <Check className="size-4" aria-hidden="true" /> Saved
          </span>
        )}
      </div>
    </form>
  );
}
