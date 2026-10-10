import type { AuthUser } from '@app/shared';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { businessService, profileService } from '@/services/business.service';
import { useAuthStore } from '@/store/authStore';

export const businessKeys = {
  all: ['business'] as const,
  dashboard: () => [...businessKeys.all, 'dashboard'] as const,
  analytics: (days: number) => [...businessKeys.all, 'analytics', days] as const,
  customers: (page: number) => [...businessKeys.all, 'customers', page] as const,
};

export function useBusinessDashboard() {
  return useQuery({
    queryKey: businessKeys.dashboard(),
    queryFn: businessService.dashboard,
    refetchInterval: 30_000,
  });
}

export function useBusinessAnalytics(days: number) {
  return useQuery({
    queryKey: businessKeys.analytics(days),
    queryFn: () => businessService.analytics(days),
    placeholderData: keepPreviousData,
  });
}

export function useCustomers(page: number) {
  return useQuery({
    queryKey: businessKeys.customers(page),
    queryFn: () => businessService.customers(page),
    placeholderData: keepPreviousData,
  });
}

/** Profile changes return the updated account; keep the signed-in user in sync. */
function useAccountMutation<T>(fn: (input: T) => Promise<AuthUser>) {
  return useMutation({
    mutationFn: fn,
    onSuccess: (user) => useAuthStore.getState().setUser(user),
  });
}

export const useUpdateBusiness = () => useAccountMutation(businessService.update);
export const useUploadLogo = () => useAccountMutation(businessService.uploadLogo);
export const useUpdateProfile = () => useAccountMutation(profileService.update);
export const useUploadAvatar = () => useAccountMutation(profileService.uploadAvatar);
export const useRemoveAvatar = () => useAccountMutation(profileService.removeAvatar);
