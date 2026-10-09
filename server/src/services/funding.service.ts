import { formatMoney } from '@app/shared';
import { getPaymentProvider } from '../providers/payment/registry.js';
import { walletRepository } from '../repositories/wallet.repository.js';
import { AppError } from '../utils/AppError.js';
import { toAmountString, type Money } from '../utils/money.js';
import { generateTransactionReference } from '../utils/reference.js';
import type { RequestContext } from '../utils/requestContext.js';
import { runInTransaction } from '../utils/transaction.js';
import { AUDIT_ACTIONS, recordAudit } from './audit.service.js';
import { postTransfer, type PostedTransfer } from './ledger.service.js';
import { createNotification } from './notification.service.js';

interface FundWalletInput {
  walletId: string;
  amount: Money;
  /** Who triggered the funding (SYSTEM for the seed, an ADMIN later). */
  initiatorId: string;
  reason: string;
  context?: RequestContext;
}

/**
 * Credits a wallet with simulated money from the treasury, settled through the
 * DemoProvider. This is how every demo balance comes into existence — balances
 * are never written directly.
 */
export async function fundWallet(input: FundWalletInput): Promise<PostedTransfer> {
  const provider = getPaymentProvider('demo');
  const payment = await provider.initializePayment({
    reference: generateTransactionReference(),
    amount: toAmountString(input.amount),
    currency: 'KES',
    walletId: input.walletId,
    description: input.reason,
  });
  if (payment.status !== 'COMPLETED') {
    throw AppError.badRequest('The demo funding could not be completed.');
  }

  return runInTransaction(async (tx) => {
    const treasury = await walletRepository.findTreasury(tx);
    if (!treasury) throw new Error('Treasury wallet is missing — run the seed.');
    const wallet = await tx.wallet.findUnique({
      where: { id: input.walletId },
      select: { userId: true },
    });
    if (!wallet) throw AppError.notFound('Wallet not found.');

    const posted = await postTransfer(tx, {
      type: 'FUNDING',
      fromWalletId: treasury.id,
      toWalletId: input.walletId,
      amount: input.amount,
      initiatorId: input.initiatorId,
      note: input.reason,
      provider: provider.id,
      providerRef: payment.providerRef,
      metadata: { simulated: true },
    });

    await recordAudit(tx, {
      action: AUDIT_ACTIONS.WALLET_FUNDED,
      actorId: input.initiatorId,
      entityType: 'transaction',
      entityId: posted.id,
      ...(input.context ? { context: input.context } : {}),
      metadata: {
        walletId: input.walletId,
        amount: toAmountString(input.amount),
        reference: posted.reference,
      },
    });
    await createNotification(tx, {
      userId: wallet.userId,
      type: 'MONEY_RECEIVED',
      title: 'Demo funds added',
      body: `Your wallet was credited with ${formatMoney(toAmountString(input.amount))} in simulated demo funds.`,
      data: { reference: posted.reference },
    });
    return posted;
  });
}
