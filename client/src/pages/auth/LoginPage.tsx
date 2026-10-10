import { loginSchema, type LoginInput } from '@app/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { FormAlert } from '@/components/feedback/FormAlert';
import { PasswordInput } from '@/components/forms/PasswordInput';
import { TextInput } from '@/components/forms/TextInput';
import { Button } from '@/components/ui/Button';
import { homePathFor } from '@/config/navigation';
import { safeReturnPath } from '@/router/guards';
import { authService } from '@/services/auth.service';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = safeReturnPath(location.state);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });

  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
      void navigate(from ?? homePathFor(session.user.role), { replace: true });
    },
    onError: (error) => setFormError(toApiClientError(error).message),
  });

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome back</h1>
        <p className="text-fg-muted">Sign in to your demo wallet.</p>
      </div>

      <form
        noValidate
        className="space-y-5"
        onSubmit={handleSubmit((values) => {
          setFormError(null);
          mutation.mutate(values);
        })}
      >
        <FormAlert message={formError} />
        <TextInput
          label="E-mail, phone or username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com, 0712… or @username"
          error={errors.identifier?.message}
          {...register('identifier')}
        />
        <PasswordInput
          label="Password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={mutation.isPending}
          leftIcon={<LogIn className="size-5" aria-hidden="true" />}
        >
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-fg-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-primary hover:underline">
          Create a demo account
        </Link>
      </p>

      <DemoCredentials />
    </div>
  );
}

/** Seeded demo logins, shown only in development builds. */
function DemoCredentials() {
  if (!import.meta.env.DEV) return null;
  return (
    <details className="rounded-xl border border-dashed border-border-strong px-4 py-3 text-sm">
      <summary className="cursor-pointer font-medium text-fg-muted">
        Demo accounts (development)
      </summary>
      <ul className="mt-2 space-y-1 font-mono text-xs text-fg-muted">
        <li>@caleb254 · Demo@2026 · PIN 1357</li>
        <li>@visiblegeneral · Demo@2026 · PIN 1357</li>
        <li>@admin · Admin@2026</li>
      </ul>
    </details>
  );
}
