import type {
  ApiSuccess,
  AuthUser,
  BusinessAnalytics,
  BusinessDashboard,
  BusinessPublicProfile,
  CustomerSummary,
  PagedResult,
  UpdateBusinessInput,
  UpdateProfileInput,
} from '@app/shared';
import { api, unwrap } from './api';

function imageForm(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export const businessService = {
  dashboard: () => unwrap(api.get<ApiSuccess<BusinessDashboard>>('/businesses/me/dashboard')),
  analytics: (days: number) =>
    unwrap(
      api.get<ApiSuccess<BusinessAnalytics>>('/businesses/me/analytics', { params: { days } }),
    ),
  customers: (page: number, limit = 20) =>
    unwrap(
      api.get<ApiSuccess<PagedResult<CustomerSummary>>>('/businesses/me/customers', {
        params: { page, limit },
      }),
    ),
  update: (input: UpdateBusinessInput) =>
    unwrap(api.patch<ApiSuccess<AuthUser>>('/businesses/me', input)),
  uploadLogo: (file: File) =>
    unwrap(api.post<ApiSuccess<AuthUser>>('/businesses/me/logo', imageForm(file))),
  publicProfile: (username: string) =>
    unwrap(
      api.get<ApiSuccess<BusinessPublicProfile>>(`/businesses/${encodeURIComponent(username)}`),
    ),
};

export const profileService = {
  update: (input: UpdateProfileInput) =>
    unwrap(api.patch<ApiSuccess<AuthUser>>('/users/me', input)),
  uploadAvatar: (file: File) =>
    unwrap(api.post<ApiSuccess<AuthUser>>('/users/me/avatar', imageForm(file))),
  removeAvatar: () => unwrap(api.delete<ApiSuccess<AuthUser>>('/users/me/avatar')),
};
