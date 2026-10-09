import { DemoProvider } from './DemoProvider.js';
import type { PaymentProvider, ProviderId } from './PaymentProvider.js';

/**
 * The only place providers are registered. V1 deliberately contains the demo
 * provider alone; adding a real-money provider is an explicit, reviewable change.
 */
const providers: Record<ProviderId, PaymentProvider> = {
  demo: new DemoProvider(),
};

export function getPaymentProvider(id: ProviderId = 'demo'): PaymentProvider {
  return providers[id];
}
