import type { DbClient } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { RequestContext } from '../utils/requestContext.js';

export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  BUSINESS_REGISTERED: 'BUSINESS_REGISTERED',
  LOGIN_SUCCEEDED: 'LOGIN_SUCCEEDED',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  LOGIN_BLOCKED_SUSPENDED: 'LOGIN_BLOCKED_SUSPENDED',
  LOGOUT: 'LOGOUT',
  SESSION_REUSE_DETECTED: 'SESSION_REUSE_DETECTED',
  PIN_FAILED: 'PIN_FAILED',
  PIN_LOCKED: 'PIN_LOCKED',
  WALLET_FUNDED: 'WALLET_FUNDED',
  TRANSFER_COMPLETED: 'TRANSFER_COMPLETED',
  REQUEST_CREATED: 'REQUEST_CREATED',
  REQUEST_PAID: 'REQUEST_PAID',
  REQUEST_DECLINED: 'REQUEST_DECLINED',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  SPLIT_CREATED: 'SPLIT_CREATED',
  SPLIT_CANCELLED: 'SPLIT_CANCELLED',
  QR_ROTATED: 'QR_ROTATED',
  QR_CREATED: 'QR_CREATED',
  QR_REVOKED: 'QR_REVOKED',
  BUSINESS_UPDATED: 'BUSINESS_UPDATED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  IMAGE_UPLOADED: 'IMAGE_UPLOADED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

interface AuditEntry {
  action: AuditAction;
  actorId: string | null;
  entityType: string;
  entityId?: string | null;
  context?: RequestContext;
  metadata?: Prisma.InputJsonObject;
}

/** Appends to the immutable audit trail. Never pass secrets in `metadata`. */
export async function recordAudit(db: DbClient, entry: AuditEntry): Promise<void> {
  await db.auditLog.create({
    data: {
      action: entry.action,
      actorId: entry.actorId,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      ip: entry.context?.ip ?? null,
      userAgent: entry.context?.userAgent ?? null,
      requestId: entry.context?.requestId ?? null,
      ...(entry.metadata ? { metadata: entry.metadata } : {}),
    },
  });
}
