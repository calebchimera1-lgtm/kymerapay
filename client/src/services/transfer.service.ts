import type { ApiSuccess, CreateTransferInput, PublicProfile, TransferResult } from '@app/shared';
import { api, unwrap } from './api';

export const transferService = {
  send: (input: CreateTransferInput, idempotencyKey: string) =>
    unwrap(
      api.post<ApiSuccess<TransferResult>>('/transfers', input, {
        headers: { 'Idempotency-Key': idempotencyKey },
      }),
    ),
  recentRecipients: () =>
    unwrap(api.get<ApiSuccess<PublicProfile[]>>('/transfers/recent-recipients')),
};

export const directoryService = {
  search: (q: string) =>
    unwrap(api.get<ApiSuccess<PublicProfile[]>>('/users/search', { params: { q } })),
  profile: (username: string) =>
    unwrap(api.get<ApiSuccess<PublicProfile>>(`/users/${encodeURIComponent(username)}`)),
};
