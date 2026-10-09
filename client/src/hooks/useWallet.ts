import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { walletService } from '@/services/wallet.service';

export const walletKeys = {
  all: ['wallet'] as const,
  wallet: () => [...walletKeys.all, 'detail'] as const,
  summary: () => [...walletKeys.all, 'summary'] as const,
  entries: (limit: number) => [...walletKeys.all, 'entries', limit] as const,
};

/** Balance is server-owned: always fetched, never computed on the client. */
export function useWallet() {
  return useQuery({
    queryKey: walletKeys.wallet(),
    queryFn: walletService.get,
    refetchInterval: 30_000,
  });
}

export function useWalletSummary() {
  return useQuery({ queryKey: walletKeys.summary(), queryFn: walletService.summary });
}

export function useWalletEntries(limit = 20) {
  return useInfiniteQuery({
    queryKey: walletKeys.entries(limit),
    queryFn: ({ pageParam }) =>
      walletService.entries({ limit, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
