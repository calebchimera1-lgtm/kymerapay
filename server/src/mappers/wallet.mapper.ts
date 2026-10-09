import type { Counterparty, WalletDto, WalletEntry } from '@app/shared';
import type { Wallet } from '../generated/prisma/client.js';
import type { EntryWithTransaction } from '../repositories/wallet.repository.js';
import { toAmountString } from '../utils/money.js';

export function toWalletDto(wallet: Wallet): WalletDto {
  return {
    id: wallet.id,
    type: wallet.type,
    currency: 'KES',
    balance: toAmountString(wallet.balance),
    status: wallet.status,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

/** Any user row selected with `counterpartyUserSelect`. */
export type PartyUser = Pick<
  EntryWithTransaction['transaction']['toWallet']['user'],
  'fullName' | 'username' | 'avatarUrl' | 'role' | 'businessProfile'
>;

/** Public identity only: never phone numbers, e-mails or balances. */
export function toCounterparty(user: PartyUser): Counterparty {
  if (user.role === 'SYSTEM') {
    return { kind: 'system', displayName: 'Demo funds', username: null, avatarUrl: null };
  }
  if (user.businessProfile) {
    return {
      kind: 'business',
      displayName: user.businessProfile.businessName,
      username: user.username,
      avatarUrl: user.businessProfile.logoUrl,
    };
  }
  return {
    kind: 'person',
    displayName: user.fullName,
    username: user.username,
    avatarUrl: user.avatarUrl,
  };
}

export function toWalletEntry(entry: EntryWithTransaction): WalletEntry {
  const { transaction } = entry;
  const other =
    entry.direction === 'DEBIT' ? transaction.toWallet.user : transaction.fromWallet.user;
  return {
    id: entry.id,
    transactionId: transaction.id,
    reference: transaction.reference,
    type: transaction.type,
    direction: entry.direction,
    amount: toAmountString(entry.amount),
    balanceAfter: toAmountString(entry.balanceAfter),
    note: transaction.note,
    counterparty: toCounterparty(other),
    createdAt: entry.createdAt.toISOString(),
  };
}
