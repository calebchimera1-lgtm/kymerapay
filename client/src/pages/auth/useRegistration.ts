import type { AuthSession } from '@app/shared';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { homePathFor } from '@/config/navigation';
import { useAuthStore } from '@/store/authStore';

/** Shared success path for both registration forms. */
export function useRegistration<TInput>(
  submit: (input: TInput) => Promise<AuthSession>,
  onError: (error: unknown) => void,
) {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: submit,
    onSuccess: (session) => {
      useAuthStore.getState().setSession(session);
      void navigate(homePathFor(session.user.role), { replace: true });
    },
    onError,
  });
}
