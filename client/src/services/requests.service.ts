import type {
  ApiSuccess,
  BillSplitDto,
  CreateBillSplitInput,
  CreatePaymentRequestInput,
  Paginated,
  PaymentRequestDto,
  PaymentRequestStatus,
  PaymentRequestSummary,
  PayRequestResult,
} from '@app/shared';
import { api, unwrap } from './api';

export interface ListRequestsParams {
  direction: 'incoming' | 'outgoing';
  status?: PaymentRequestStatus;
  cursor?: string;
  limit?: number;
}

export const requestService = {
  create: (input: CreatePaymentRequestInput) =>
    unwrap(api.post<ApiSuccess<PaymentRequestDto>>('/payment-requests', input)),
  list: (params: ListRequestsParams) =>
    unwrap(api.get<ApiSuccess<Paginated<PaymentRequestDto>>>('/payment-requests', { params })),
  summary: () => unwrap(api.get<ApiSuccess<PaymentRequestSummary>>('/payment-requests/summary')),
  pay: (id: string, pin: string, idempotencyKey: string) =>
    unwrap(
      api.post<ApiSuccess<PayRequestResult>>(
        `/payment-requests/${id}/pay`,
        { pin },
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    ),
  decline: (id: string) =>
    unwrap(api.post<ApiSuccess<PaymentRequestDto>>(`/payment-requests/${id}/decline`)),
  cancel: (id: string) =>
    unwrap(api.post<ApiSuccess<PaymentRequestDto>>(`/payment-requests/${id}/cancel`)),
};

export const splitService = {
  create: (input: CreateBillSplitInput) =>
    unwrap(api.post<ApiSuccess<BillSplitDto>>('/bill-splits', input)),
  list: () => unwrap(api.get<ApiSuccess<BillSplitDto[]>>('/bill-splits')),
  get: (id: string) => unwrap(api.get<ApiSuccess<BillSplitDto>>(`/bill-splits/${id}`)),
  cancel: (id: string) => unwrap(api.post<ApiSuccess<BillSplitDto>>(`/bill-splits/${id}/cancel`)),
};
