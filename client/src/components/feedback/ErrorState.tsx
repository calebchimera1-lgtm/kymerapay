import { AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/utils/cn';

interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We could not load this right now. Please try again.',
  requestId,
  onRetry,
  retrying,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center px-6 py-10 text-center', className)}
    >
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{message}</p>
      {requestId && <p className="mt-2 font-mono text-xs text-fg-subtle">Ref: {requestId}</p>}
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          className="mt-5"
          onClick={onRetry}
          loading={retrying}
          leftIcon={<RotateCw className="size-4" aria-hidden="true" />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
