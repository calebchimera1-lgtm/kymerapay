import type { TransactionType, WalletStatus, WalletType } from './enums.js';

export interface WalletDto {
  id: string;
  type: WalletType;
  currency: 'KES';
  /** Two-decimal string, e.g. "24850.00". */
  balance: string;
  status: WalletStatus;
  updatedAt: string;
}

export interface Counterparty {
  kind: 'person' | 'business' | 'system';
  displayName: string;
  /** Null for the system treasury. */
  username: string | null;
  avatarUrl: string | null;
}

/** One line of the owner's wallet statement (a ledger entry, from their side). */
export interface WalletEntry {
  id: string;
  transactionId: string;
  reference: string;
  type: TransactionType;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
  balanceAfter: string;
  note: string | null;
  counterparty: Counterparty;
  createdAt: string;
}

export interface DailyFlow {
  /** Calendar day in Africa/Nairobi, YYYY-MM-DD. */
  date: string;
  moneyIn: string;
  moneyOut: string;
}

export interface WalletSummary {
  periodDays: number;
  moneyIn: string;
  moneyOut: string;
  net: string;
  transactionCount: number;
  daily: DailyFlow[];
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export interface TransactionLimits {
  minAmount: string;
  maxAmount: string;
  dailyLimit: string;
}
