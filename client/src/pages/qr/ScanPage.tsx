import { parseQrPayload } from '@app/shared';
import { QrCode } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ErrorState } from '@/components/feedback/ErrorState';
import { PageHeader } from '@/components/layout/PageHeader';
import { QrScanner } from '@/components/qr/QrScanner';

/**
 * Scan → validate → confirmation screen. Scanned text is untrusted: it is only
 * used to extract an opaque code, which the server resolves. Nothing is paid
 * until the user reviews the payee and confirms with their PIN.
 */
export function ScanPage() {
  const navigate = useNavigate();
  const [rejected, setRejected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Scan & Pay"
        description="Scan a person's or business's payment QR."
        actions={
          <Link
            to="/app/qr"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
          >
            <QrCode className="size-4" aria-hidden="true" /> My QR
          </Link>
        }
      />
      {rejected ? (
        <ErrorState
          title="That isn't a payment QR code"
          message="Only payment codes from this app can be scanned here."
          onRetry={() => {
            setRejected(null);
            setAttempt((n) => n + 1);
          }}
        />
      ) : (
        <QrScanner
          key={attempt}
          onResult={(text) => {
            const code = parseQrPayload(text);
            if (code) void navigate(`/app/send?qr=${encodeURIComponent(code)}`);
            else setRejected(text);
          }}
        />
      )}
    </div>
  );
}
