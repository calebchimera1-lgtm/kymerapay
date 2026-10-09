import { Compass } from 'lucide-react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/feedback/EmptyState';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      description="The page you are looking for does not exist or has moved."
      className="py-24"
      action={
        <Link
          to="/"
          className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          Go home
        </Link>
      }
    />
  );
}
