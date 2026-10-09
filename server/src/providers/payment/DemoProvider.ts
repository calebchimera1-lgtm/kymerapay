import { randomUUID } from 'node:crypto';
import type {
  InitializePaymentInput,
  PaymentProvider,
  ProviderPaymentResult,
  ProviderPaymentStatus,
  RefundInput,
} from './PaymentProvider.js';

/**
 * Simulated money source. Settles instantly and never contacts any external
 * system — there is nothing to call. Every result is marked `simulated`.
 */
export class DemoProvider implements PaymentProvider {
  readonly id = 'demo' as const;
  readonly displayName = 'Demo funds (simulated)';

  async initializePayment(input: InitializePaymentInput): Promise<ProviderPaymentResult> {
    return {
      providerRef: `DEMO-${randomUUID()}`,
      status: 'COMPLETED',
      raw: { simulated: true, reference: input.reference },
    };
  }

  async verifyPayment(providerRef: string): Promise<ProviderPaymentResult> {
    return { providerRef, status: 'COMPLETED', raw: { simulated: true } };
  }

  async getTransactionStatus(_providerRef: string): Promise<ProviderPaymentStatus> {
    return 'COMPLETED';
  }

  async refundPayment(input: RefundInput): Promise<ProviderPaymentResult> {
    return {
      providerRef: `DEMO-REFUND-${randomUUID()}`,
      status: 'COMPLETED',
      raw: { simulated: true, original: input.providerRef },
    };
  }
}
