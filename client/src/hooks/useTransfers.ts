import type { CreateTransferInput } from '@app/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { directoryService, transferService } from '@/services/transfer.service';
import { walletKeys } from './useWallet';

/** Personal accounts only — the endpoint is USER-scoped, so other roles skip the call. */
export function useRecentRecipients() {
  const isPersonal = useAuthStore((state) => state.user?.role === 'USER');
  return useQuery({
    queryKey: ['transfers', 'recent-recipients'],
    queryFn: transferService.recentRecipients,
    enabled: isPersonal,
  });
}

/** Debounced directory search; idle below 2 characters. */
export function useUserSearch(term: string, delayMs = 250) {
  const [debounced, setDebounced] = useState(term);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), delayMs);
    return () => clearTimeout(timer);
  }, [term, delayMs]);

  const q = debounced.replace(/^@/, '');
  return useQuery({
    queryKey: ['users', 'search', q],
    queryFn: () => directoryService.search(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}

export function usePublicProfile(username: string | null) {
  return useQuery({
    queryKey: ['users', 'profile', username],
    queryFn: () => directoryService.profile(username!),
    enabled: Boolean(username),
    retry: false,
  });
}

export function useSendMoney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateTransferInput;
      idempotencyKey: string;
    }) => transferService.send(input, idempotencyKey),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys.all });
      void queryClient.invalidateQueries({ queryKey: ['transfers', 'recent-recipients'] });
    },
  });
}
