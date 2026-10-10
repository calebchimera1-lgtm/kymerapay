import type { ApiSuccess, GenerateQrInput, QrCodeDto, QrResolution } from '@app/shared';
import { api, unwrap } from './api';

export const qrService = {
  mine: () => unwrap(api.get<ApiSuccess<QrCodeDto>>('/qr/me')),
  generate: (input: GenerateQrInput) =>
    unwrap(api.post<ApiSuccess<QrCodeDto>>('/qr/generate', input)),
  dynamic: () => unwrap(api.get<ApiSuccess<QrCodeDto[]>>('/qr/dynamic')),
  revoke: (id: string) => unwrap(api.post<ApiSuccess<QrCodeDto>>(`/qr/${id}/revoke`)),
  resolve: (code: string) =>
    unwrap(api.get<ApiSuccess<QrResolution>>(`/qr/resolve/${encodeURIComponent(code)}`)),
};
