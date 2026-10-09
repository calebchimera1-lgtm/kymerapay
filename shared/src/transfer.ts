import type { Counterparty } from './wallet.js';
import type { Visibility } from './enums.js';

/** What anyone may see about another account. Never contains phone, e-mail or balance. */
export interface PublicProfile {
  id: string;
  kind: 'person' | 'business';
  displayName: string;
  username: string;
  avatarUrl: string | null;
  /** Business accounts only. */
  businessCategory: string | null;
  isVerified: boolean;
}

export interface TransferReceipt {
  id: string;
  reference: string;
  type: 'TRANSFER' | 'BUSINESS_PAYMENT';
  amount: string;
  note: string | null;
  visibility: Visibility;
  recipient: Counterparty;
  createdAt: string;
}

/** `POST /api/transfers` → 201 */
export interface TransferResult {
  transaction: TransferReceipt;
  /** Sender's balance after the transfer. */
  balance: string;
}
