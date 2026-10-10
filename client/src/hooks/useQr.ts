import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qrService } from '@/services/qr.service';

export const qrKeys = {
  all: ['qr'] as const,
  mine: () => [...qrKeys.all, 'mine'] as const,
  dynamic: () => [...qrKeys.all, 'dynamic'] as const,
  resolve: (code: string | null) => [...qrKeys.all, 'resolve', code] as const,
};

export function useMyQr() {
  return useQuery({ queryKey: qrKeys.mine(), queryFn: qrService.mine, staleTime: 5 * 60_000 });
}

export function useDynamicQrs(enabled = true) {
  return useQuery({
    queryKey: qrKeys.dynamic(),
    queryFn: qrService.dynamic,
    enabled,
    refetchInterval: 30_000,
  });
}

/** What a scanned code would pay. Read-only — nothing moves until the user confirms with a PIN. */
export function useQrResolution(code: string | null) {
  return useQuery({
    queryKey: qrKeys.resolve(code),
    queryFn: () => qrService.resolve(code!),
    enabled: Boolean(code),
    retry: false,
    staleTime: 0,
  });
}

export function useGenerateQr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: qrService.generate,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qrKeys.all }),
  });
}

export function useRevokeQr() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: qrService.revoke,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qrKeys.dynamic() }),
  });
}
