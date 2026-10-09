import { useQuery } from '@tanstack/react-query';
import { systemService } from '@/services/system.service';

export const systemKeys = {
  health: ['system', 'health'] as const,
  config: ['system', 'config'] as const,
};

export function useHealth() {
  return useQuery({
    queryKey: systemKeys.health,
    queryFn: systemService.getHealth,
    refetchInterval: 30_000,
  });
}

export function usePublicConfig() {
  return useQuery({
    queryKey: systemKeys.config,
    queryFn: systemService.getPublicConfig,
    staleTime: 5 * 60_000,
  });
}
