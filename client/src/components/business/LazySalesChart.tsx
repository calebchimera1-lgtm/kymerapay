import type { SalesDay } from '@app/shared';
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/feedback/LoadingState';

const SalesChart = lazy(() =>
  import('./SalesChart').then((module) => ({ default: module.SalesChart })),
);

/** Keeps the charting library out of the main bundle. */
export function LazySalesChart(props: { days: SalesDay[]; title: string }) {
  return (
    <Suspense fallback={<Skeleton className="h-64" />}>
      <SalesChart {...props} />
    </Suspense>
  );
}
