import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';

/** Revokes the server session, then wipes every piece of client-side account state. */
export function useSignOut() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  const signOut = useCallback(async () => {
    setPending(true);
    try {
      await authService.logout();
    } catch {
      // Even if the server is unreachable, the local session must end.
    } finally {
      useAuthStore.getState().clear();
      queryClient.clear();
      setPending(false);
      void navigate('/login', { replace: true });
    }
  }, [navigate, queryClient]);

  return { signOut, pending };
}
