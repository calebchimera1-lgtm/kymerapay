import type {
  BillSplitStatus,
  ParticipantStatus,
  PaymentRequestStatus,
  SplitMethod,
} from './enums.js';
import type { TransferReceipt } from './transfer.js';
import type { Counterparty } from './wallet.js';

export interface PaymentRequestDto {
  id: string;
  /** From the caller's point of view: `incoming` = someone is asking *you* to pay. */
  direction: 'incoming' | 'outgoing';
  status: PaymentRequestStatus;
  amount: string;
  note: string | null;
  /** The other person (the requester for incoming, the payer for outgoing). */
  counterparty: Counterparty;
  billSplit: { id: string; title: string } | null;
  transactionReference: string | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
}

export interface PaymentRequestSummary {
  incomingPending: number;
  incomingPendingAmount: string;
  outgoingPending: number;
  outgoingPendingAmount: string;
}

/** `POST /api/payment-requests/:id/pay` → 201 */
export interface PayRequestResult {
  request: PaymentRequestDto;
  transaction: Omit<TransferReceipt, 'type'> & { type: 'REQUEST_PAYMENT' | 'SPLIT_PAYMENT' };
  balance: string;
}

export interface BillParticipantDto {
  id: string;
  user: Counterparty;
  isCreator: boolean;
  amountOwed: string;
  amountPaid: string;
  status: ParticipantStatus;
  paymentRequestId: string | null;
  paidAt: string | null;
}

export interface BillSplitDto {
  id: string;
  title: string;
  note: string | null;
  totalAmount: string;
  method: SplitMethod;
  status: BillSplitStatus;
  isCreator: boolean;
  creator: Counterparty;
  participants: BillParticipantDto[];
  /** Includes the creator's own share, which counts as settled. */
  amountPaid: string;
  amountRemaining: string;
  createdAt: string;
}
