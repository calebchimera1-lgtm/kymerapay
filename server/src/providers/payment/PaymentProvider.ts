/**
 * Boundary between the wallet ledger and external money rails.
 *
 * V1 registers only the DemoProvider, which settles instantly with simulated
 * money. Real rails (e.g. an M-Pesa STK push, bank transfers, cards) would
 * implement this interface in a later version — after the regulatory review
 * described in docs/security.md. They must NOT be added to V1.
 *
 * Flow for a future asynchronous provider:
 *   initializePayment() → PENDING transaction recorded (no ledger lines yet)
 *   provider callback / verifyPayment() → COMPLETED + ledger lines posted
 *                                       → or FAILED (nothing posted)
 */
export type ProviderId = 'demo';

export type ProviderPaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface InitializePaymentInput {
  /** Our transaction reference, passed to the provider for reconciliation. */
  reference: string;
  /** Two-decimal string. */
  amount: string;
  currency: 'KES';
  /** Wallet that will be credited when the payment completes. */
  walletId: string;
  description: string;
}

export interface ProviderPaymentResult {
  providerRef: string;
  status: ProviderPaymentStatus;
  /** Provider-specific, non-sensitive details stored on the transaction. */
  raw?: Record<string, string | number | boolean>;
}

export interface RefundInput {
  providerRef: string;
  amount: string;
  reason: string;
}

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  initializePayment(input: InitializePaymentInput): Promise<ProviderPaymentResult>;
  verifyPayment(providerRef: string): Promise<ProviderPaymentResult>;
  getTransactionStatus(providerRef: string): Promise<ProviderPaymentStatus>;
  refundPayment(input: RefundInput): Promise<ProviderPaymentResult>;
}
