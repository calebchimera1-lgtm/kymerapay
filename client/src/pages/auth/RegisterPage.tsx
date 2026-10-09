import { Store, User } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { cn } from '@/utils/cn';
import { BusinessRegisterForm } from './BusinessRegisterForm';
import { PersonalRegisterForm } from './PersonalRegisterForm';

type AccountKind = 'personal' | 'business';

const kinds: { value: AccountKind; label: string; description: string; Icon: typeof User }[] = [
  { value: 'personal', label: 'Personal', description: 'Send, request & split', Icon: User },
  { value: 'business', label: 'Business', description: 'Accept payments', Icon: Store },
];

export function RegisterPage() {
  const [kind, setKind] = useState<AccountKind>('personal');

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Create your account</h1>
        <p className="text-fg-muted">Demo accounts use simulated KES only.</p>
      </div>

      <div role="radiogroup" aria-label="Account type" className="grid grid-cols-2 gap-3">
        {kinds.map(({ value, label, description, Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              'flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors',
              kind === value
                ? 'border-primary bg-primary-soft text-primary-soft-fg ring-2 ring-primary/20'
                : 'border-border bg-surface hover:border-border-strong',
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs opacity-80">{description}</span>
            </span>
          </button>
        ))}
      </div>

      {kind === 'personal' ? <PersonalRegisterForm /> : <BusinessRegisterForm />}

      <p className="text-center text-sm text-fg-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
