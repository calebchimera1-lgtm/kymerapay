import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestService, splitService, type ListRequestsParams } from '@/services/requests.service';
import { walletKeys } from './useWallet';

export const requestKeys = {
  all: ['payment-requests'] as const,
  list: (params: Omit<ListRequestsParams, 'cursor'>) =>
    [...requestKeys.all, 'list', params] as const,
  summary: () => [...requestKeys.all, 'summary'] as const,
};

export const splitKeys = {
  all: ['bill-splits'] as const,
  detail: (id: string) => [...splitKeys.all, id] as const,
};

export function usePaymentRequests(params: Omit<ListRequestsParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: requestKeys.list(params),
    queryFn: ({ pageParam }) =>
      requestService.list({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
}

export function useRequestSummary() {
  return useQuery({
    queryKey: requestKeys.summary(),
    queryFn: requestService.summary,
    refetchInterval: 30_000,
  });
}

/** Anything that changes requests can also change balances and splits. */
function useInvalidateMoney() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: requestKeys.all });
    void queryClient.invalidateQueries({ queryKey: splitKeys.all });
    void queryClient.invalidateQueries({ queryKey: walletKeys.all });
  };
}

export function useCreateRequest() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: requestService.create, onSuccess: invalidate });
}

export function usePayRequest() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({
      id,
      pin,
      idempotencyKey,
    }: {
      id: string;
      pin: string;
      idempotencyKey: string;
    }) => requestService.pay(id, pin, idempotencyKey),
    onSuccess: invalidate,
  });
}

export function useRespondToRequest() {
  const invalidate = useInvalidateMoney();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'decline' | 'cancel' }) =>
      action === 'decline' ? requestService.decline(id) : requestService.cancel(id),
    onSuccess: invalidate,
  });
}

export function useBillSplits() {
  return useQuery({ queryKey: splitKeys.all, queryFn: splitService.list });
}

export function useBillSplit(id: string) {
  return useQuery({ queryKey: splitKeys.detail(id), queryFn: () => splitService.get(id) });
}

export function useCreateSplit() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: splitService.create, onSuccess: invalidate });
}

export function useCancelSplit() {
  const invalidate = useInvalidateMoney();
  return useMutation({ mutationFn: splitService.cancel, onSuccess: invalidate });
}
