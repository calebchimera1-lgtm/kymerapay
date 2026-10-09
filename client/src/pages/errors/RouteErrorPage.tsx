import { ErrorState } from '@/components/feedback/ErrorState';
import { DemoBanner } from '@/components/feedback/DemoBanner';

/** Rendered when a route throws while rendering or loading. */
export function RouteErrorPage() {
  return (
    <div className="min-h-dvh">
      <DemoBanner />
      <ErrorState
        className="py-24"
        title="This page crashed"
        message="An unexpected error occurred. Reload the page to continue."
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
