import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ErrorState } from '@/components/feedback/ErrorState';
import { FormAlert } from '@/components/feedback/FormAlert';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useGenerateQr, useMyQr } from '@/hooks/useQr';
import { toApiClientError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { QrCard } from './QrCard';

/** The account's profile QR with download/share and a guarded "replace code" action. */
export function MyQrPanel({
  size = 220,
  allowRotate = true,
}: {
  size?: number;
  allowRotate?: boolean;
}) {
  const user = useAuthStore((state) => state.user)!;
  const qr = useMyQr();
  const rotate = useGenerateQr();
  const [confirm, setConfirm] = useState(false);
  const name = user.business?.businessName ?? user.fullName;

  if (qr.isPending) return <LoadingState label="Loading your QR code…" />;
  if (qr.isError)
    return (
      <ErrorState message={toApiClientError(qr.error).message} onRetry={() => void qr.refetch()} />
    );

  return (
    <div className="space-y-4">
      <QrCard
        qr={qr.data}
        size={size}
        title={name}
        subtitle={`@${user.username}`}
        caption={
          user.role === 'BUSINESS'
            ? 'Scan to pay — demo, no real money'
            : 'Scan to pay me — demo, no real money'
        }
      />
      {allowRotate && (
        <div className="text-center print:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirm(true)}
            leftIcon={<RefreshCw className="size-4" aria-hidden="true" />}
          >
            Replace this code
          </Button>
        </div>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        dismissible={!rotate.isPending}
        title="Replace your QR code?"
        description="The current code stops working immediately — including printed copies. Use this if your code was shared where it shouldn't be."
      >
        <FormAlert message={rotate.error ? toApiClientError(rotate.error).message : null} />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            size="lg"
            onClick={() => setConfirm(false)}
            disabled={rotate.isPending}
          >
            Keep it
          </Button>
          <Button
            size="lg"
            loading={rotate.isPending}
            onClick={() =>
              rotate.mutate({ type: 'STATIC' }, { onSuccess: () => setConfirm(false) })
            }
          >
            Replace
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
