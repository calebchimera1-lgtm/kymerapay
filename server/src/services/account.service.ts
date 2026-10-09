import type { RegisterBusinessData } from '@app/shared';
import type { DbClient } from '../config/database.js';
import type { Role } from '../generated/prisma/client.js';
import { generateQrCodeValue } from '../utils/qrCode.js';

export type BusinessDetails = Omit<
  RegisterBusinessData,
  'username' | 'email' | 'phone' | 'password' | 'pin'
>;

export interface AccountRecord {
  role: Extract<Role, 'USER' | 'BUSINESS'>;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  passwordHash: string;
  pinHash: string;
  business?: BusinessDetails;
}

/**
 * Inserts a money-holding account: user + wallet + static QR code (+ business
 * profile). Call inside a transaction so the account is never half-created.
 * The wallet always starts at zero — balances only ever come from the ledger.
 */
export function insertAccount(db: DbClient, account: AccountRecord) {
  const { business } = account;
  return db.user.create({
    data: {
      fullName: account.fullName,
      username: account.username,
      email: account.email,
      phone: account.phone,
      role: account.role,
      passwordHash: account.passwordHash,
      pinHash: account.pinHash,
      isDemo: true,
      wallet: { create: { type: account.role === 'BUSINESS' ? 'BUSINESS' : 'PERSONAL' } },
      qrCodes: { create: { code: generateQrCodeValue(), type: 'STATIC' } },
      ...(business
        ? {
            businessProfile: {
              create: {
                businessName: business.businessName,
                category: business.category,
                location: business.location,
                description: business.description ?? null,
                registrationNumber: business.registrationNumber ?? null,
              },
            },
          }
        : {}),
    },
  });
}
