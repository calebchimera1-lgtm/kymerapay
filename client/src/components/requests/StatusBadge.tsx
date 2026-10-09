import type { BillSplitStatus, ParticipantStatus, PaymentRequestStatus } from '@app/shared';
import { Badge, type BadgeProps } from '@/components/ui/Badge';

type AnyStatus = PaymentRequestStatus | ParticipantStatus | BillSplitStatus;

const STYLES: Record<AnyStatus, { label: string; tone: NonNullable<BadgeProps['tone']> }> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  PAID: { label: 'Paid', tone: 'success' },
  SETTLED_SELF: { label: 'Your share', tone: 'primary' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  OPEN: { label: 'Open', tone: 'info' },
  SETTLED: { label: 'Settled', tone: 'success' },
};

/** Status is always shown as words, never colour alone. */
export function StatusBadge({ status }: { status: AnyStatus }) {
  const { label, tone } = STYLES[status];
  return <Badge tone={tone}>{label}</Badge>;
}
