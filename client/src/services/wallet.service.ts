import type { ApiSuccess, Paginated, WalletDto, WalletEntry, WalletSummary } from '@app/shared';
import { api, unwrap } from './api';

export const walletService = {
  get: () => unwrap(api.get<ApiSuccess<WalletDto>>('/wallet')),
  summary: () => unwrap(api.get<ApiSuccess<WalletSummary>>('/wallet/summary')),
  entries: (params: { cursor?: string; limit?: number }) =>
    unwrap(api.get<ApiSuccess<Paginated<WalletEntry>>>('/wallet/entries', { params })),
};
