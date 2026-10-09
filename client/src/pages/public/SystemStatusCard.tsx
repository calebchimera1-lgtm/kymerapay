import { Activity, CheckCircle2, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/feedback/LoadingState';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { useHealth, usePublicConfig } from '@/hooks/useSystemStatus';
import { toApiClientError } from '@/services/api';

/** Live connectivity check against the API — proves the stack is wired end to end. */
export function SystemStatusCard() {
  const health = useHealth();
  const config = usePublicConfig();
  const isLoading = health.isPending || config.isPending;
  const error = health.error ?? config.error;

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="size-4 text-primary" aria-hidden="true" /> System status
        </CardTitle>
        {!isLoading &&
          (error ? (
            <Badge tone="danger">Offline</Badge>
          ) : (
            <Badge tone="success">Operational</Badge>
          ))}
      </CardHeader>
      <CardBody>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <XCircle className="size-4 shrink-0 text-danger" aria-hidden="true" />
              {toApiClientError(error).message}
            </p>
            <Button
              size="sm"
              variant="secondary"
              loading={health.isFetching || config.isFetching}
              onClick={() => {
                void health.refetch();
                void config.refetch();
              }}
            >
              Retry
            </Button>
          </div>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <StatusItem label="API" value={health.data?.status === 'ok' ? 'Healthy' : 'Degraded'} />
            <StatusItem label="Mode" value={config.data?.demoBannerText ?? '—'} />
            <StatusItem
              label="Currency"
              value={`${config.data?.currency} · ${config.data?.timezone}`}
            />
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
      <div>
        <dt className="text-fg-muted">{label}</dt>
        <dd className="font-semibold">{value}</dd>
      </div>
    </div>
  );
}
