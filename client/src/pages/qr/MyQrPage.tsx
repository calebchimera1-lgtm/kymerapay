import { ScanLine } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { MyQrPanel } from '@/components/qr/MyQrPanel';
import { Card, CardBody } from '@/components/ui/Card';

export function MyQrPage() {
  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="My QR code"
        description="Anyone with the app can scan it to pay you."
        actions={
          <Link
            to="/app/scan"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline print:hidden"
          >
            <ScanLine className="size-4" aria-hidden="true" /> Scan
          </Link>
        }
      />
      <Card>
        <CardBody className="py-8">
          <MyQrPanel />
        </CardBody>
      </Card>
      <p className="mt-4 text-center text-xs text-fg-muted">
        The code doesn't contain your phone number or e-mail. Payers always see a confirmation
        screen first.
      </p>
    </div>
  );
}
