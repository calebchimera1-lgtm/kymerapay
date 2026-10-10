import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { EntryList } from '@/components/wallet/EntryList';
import { RequestList } from '@/components/requests/RequestList';
import { useRequestSummary } from '@/hooks/useRequests';
import { useMyQr } from '@/hooks/useQr';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, ScanLine } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { greetingFor } from '@/utils/dates';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader title={`${greetingFor()}, ${firstName} 👋`} />
      <BalanceCard />
      <PendingRequestsCard />
      <QrShortcutCard />
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <Link
            to="/app/wallet"
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
          >
            See all <ChevronRight className="size-4" aria-hidden="true" />
          </Link>
        </CardHeader>
        <CardBody className="pt-1">
          <EntryList limit={5} paginate={false} />
        </CardBody>
      </Card>
    </div>
  );
}

/** "@caleb254 requested KSh 2,000 [Pay] [Decline]" — only shown when something is waiting. */
function PendingRequestsCard() {
  const summary = useRequestSummary();
  const count = summary.data?.incomingPending ?? 0;
  if (count === 0) return null;
  return (
    <Card className="border-warning/40">
      <CardHeader>
        <CardTitle>
          Requests for you <span className="text-fg-muted">({count})</span>
        </CardTitle>
        <Link
          to="/app/requests"
          className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline"
        >
          See all <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </CardHeader>
      <CardBody className="py-1">
        <RequestList direction="incoming" status="PENDING" limit={3} paginate={false} />
      </CardBody>
    </Card>
  );
}

/** "Get paid" shortcut: a small live QR plus quick links to the full code and the scanner. */
function QrShortcutCard() {
  const qr = useMyQr();
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <Link
          to="/app/qr"
          aria-label="Open my QR code"
          className="shrink-0 rounded-xl bg-white p-2 ring-1 ring-black/5"
        >
          {qr.data ? (
            <QRCodeSVG
              value={qr.data.payload}
              size={64}
              level="M"
              marginSize={0}
              fgColor="#0b0f0d"
              bgColor="#ffffff"
            />
          ) : (
            <span className="block size-16 animate-pulse rounded-lg bg-surface-muted" />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Get paid with your QR</p>
          <p className="text-sm text-fg-muted">Let friends scan to pay you instantly.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Link
            to="/app/qr"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary-soft px-3 text-sm font-semibold text-primary-soft-fg"
          >
            <QrCode className="size-4" aria-hidden="true" /> Show
          </Link>
          <Link
            to="/app/scan"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold"
          >
            <ScanLine className="size-4" aria-hidden="true" /> Scan
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
