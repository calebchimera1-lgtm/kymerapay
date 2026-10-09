import {
  allocateEqualSplit,
  compareAmounts,
  formatMoney,
  MAX_SPLIT_PARTICIPANTS,
  normalizeAmount,
  subtractAmounts,
  sumAmounts,
  type PublicProfile,
  type SplitMethod,
} from '@app/shared';
import { UserPlus, X } from 'lucide-react';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { FormAlert } from '@/components/feedback/FormAlert';
import { PageHeader } from '@/components/layout/PageHeader';
import { AmountField } from '@/components/payments/AmountField';
import { ProfileRow } from '@/components/payments/ProfileRow';
import { RecipientPicker } from '@/components/payments/RecipientPicker';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { useCreateSplit } from '@/hooks/useRequests';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';

interface Person {
  profile: PublicProfile;
  /** Raw input for CUSTOM splits. */
  amount: string;
}

/** Works out each share exactly as the server will (same shared function). */
function preview(
  total: string | null,
  method: SplitMethod,
  includeSelf: boolean,
  people: Person[],
) {
  if (!total || people.length === 0) return null;
  if (method === 'EQUAL') {
    const shares = allocateEqualSplit(total, people.length + (includeSelf ? 1 : 0));
    const mine = includeSelf ? shares.shift()! : '0.00';
    return { mine, others: shares, problem: null };
  }
  const others = people.map((person) => normalizeAmount(person.amount) ?? '0.00');
  const mine = subtractAmounts(total, sumAmounts(others));
  let problem: string | null = null;
  if (mine.startsWith('-'))
    problem = `The shares are ${formatMoney(mine.slice(1))} more than the total.`;
  else if (!includeSelf && compareAmounts(mine, '0') !== 0)
    problem = `${formatMoney(mine)} is not assigned to anyone yet.`;
  return { mine: includeSelf ? mine : '0.00', others, problem };
}

export function NewSplitPage() {
  const navigate = useNavigate();
  const me = useAuthStore((state) => state.user!);
  const create = useCreateSplit();
  const titleId = useId();
  const totalId = useId();

  const [title, setTitle] = useState('');
  const [total, setTotal] = useState('');
  const [method, setMethod] = useState<SplitMethod>('EQUAL');
  const [includeSelf, setIncludeSelf] = useState(true);
  const [people, setPeople] = useState<Person[]>([]);
  const [adding, setAdding] = useState(false);

  const normalizedTotal = normalizeAmount(total);
  const shares = preview(normalizedTotal, method, includeSelf, people);
  const serverError = create.error ? toApiClientError(create.error) : null;
  const serverMessage = serverError
    ? [serverError.message, ...(serverError.details ?? []).map((detail) => detail.message)].join(
        ' ',
      )
    : null;

  const canSubmit =
    title.trim().length >= 2 &&
    normalizedTotal !== null &&
    compareAmounts(normalizedTotal, '0') > 0 &&
    people.length > 0 &&
    !shares?.problem &&
    (method === 'EQUAL' || people.every((person) => normalizeAmount(person.amount)));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Split a bill"
        description="Everyone you add gets a request for their share."
      />
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSubmit || !normalizedTotal) return;
          create.mutate(
            {
              title: title.trim(),
              totalAmount: normalizedTotal,
              method,
              includeSelf,
              participants: people.map((person) => ({
                username: person.profile.username,
                ...(method === 'CUSTOM' ? { amount: normalizeAmount(person.amount) ?? '0' } : {}),
              })),
            },
            { onSuccess: (split) => void navigate(`/app/split/${split.id}`, { replace: true }) },
          );
        }}
      >
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor={titleId} className="text-sm font-medium">
                What's the bill for?
              </label>
              <input
                id={titleId}
                value={title}
                maxLength={80}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Dinner at Carnivore"
                className="h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
              />
            </div>
            <div className="space-y-1 text-center">
              <label htmlFor={totalId} className="text-sm font-medium text-fg-muted">
                Total bill
              </label>
              <AmountField id={totalId} value={total} onChange={setTotal} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex-wrap">
            <CardTitle>Who's in? ({people.length + (includeSelf ? 1 : 0)})</CardTitle>
            <Tabs
              label="Split method"
              value={method}
              onChange={setMethod}
              tabs={[
                { value: 'EQUAL', label: 'Equally' },
                { value: 'CUSTOM', label: 'Custom' },
              ]}
            />
          </CardHeader>
          <CardBody className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3.5 py-3 text-sm">
              <span>
                <span className="font-semibold">Include me</span>
                <span className="block text-xs text-fg-muted">
                  Your share counts as already paid.
                </span>
              </span>
              <input
                type="checkbox"
                checked={includeSelf}
                onChange={(event) => setIncludeSelf(event.target.checked)}
                className="size-5 accent-[var(--primary)]"
              />
            </label>

            <ul className="divide-y divide-border">
              {includeSelf && (
                <li className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <ProfileRow
                      profile={{
                        kind: 'person',
                        displayName: `${me.fullName} (you)`,
                        username: me.username,
                        avatarUrl: me.avatarUrl,
                      }}
                    />
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {shares ? formatMoney(shares.mine) : '—'}
                  </span>
                </li>
              )}
              {people.map((person, index) => (
                <li key={person.profile.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <ProfileRow profile={person.profile} />
                  </div>
                  {method === 'CUSTOM' ? (
                    <input
                      inputMode="decimal"
                      aria-label={`Share for @${person.profile.username}`}
                      value={person.amount}
                      placeholder="0.00"
                      onChange={(event) =>
                        setPeople((list) =>
                          list.map((item, i) =>
                            i === index
                              ? { ...item, amount: event.target.value.replace(/[^\d.,]/g, '') }
                              : item,
                          ),
                        )
                      }
                      className={cn(
                        'h-10 w-28 rounded-lg border bg-surface px-2.5 text-right tabular-nums outline-none focus:border-primary',
                        person.amount && !normalizeAmount(person.amount)
                          ? 'border-danger'
                          : 'border-border',
                      )}
                    />
                  ) : (
                    <span className="text-sm font-semibold tabular-nums">
                      {shares ? formatMoney(shares.others[index]!) : '—'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setPeople((list) => list.filter((_, i) => i !== index))}
                    aria-label={`Remove @${person.profile.username}`}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-danger"
                  >
                    <X className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>

            {shares?.problem && (
              <p role="alert" className="text-sm font-medium text-danger">
                {shares.problem}
              </p>
            )}

            {adding ? (
              <div className="space-y-3 rounded-2xl border border-dashed border-border-strong p-3">
                <RecipientPicker
                  placeholder="Add someone by @username or name"
                  accept={(profile) =>
                    profile.kind === 'person' &&
                    !people.some((person) => person.profile.id === profile.id)
                  }
                  onSelect={(profile) => {
                    setPeople((list) => [...list, { profile, amount: '' }]);
                    setAdding(false);
                  }}
                />
                <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
                  Done adding
                </Button>
              </div>
            ) : (
              people.length < MAX_SPLIT_PARTICIPANTS && (
                <Button
                  variant="soft"
                  fullWidth
                  leftIcon={<UserPlus className="size-4" aria-hidden="true" />}
                  onClick={() => setAdding(true)}
                >
                  Add people
                </Button>
              )
            )}
          </CardBody>
        </Card>

        <FormAlert message={serverMessage} />
        <Button type="submit" size="lg" fullWidth disabled={!canSubmit} loading={create.isPending}>
          {people.length > 0
            ? `Send ${people.length} request${people.length === 1 ? '' : 's'}`
            : 'Split bill'}
        </Button>
      </form>
    </div>
  );
}
