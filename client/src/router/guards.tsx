import type { Role } from '@app/shared';
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { FullPageLoader } from '@/components/feedback/FullPageLoader';
import { homePathFor } from '@/config/navigation';
import { useAuthStore } from '@/store/authStore';

/**
 * Client-side gate for signed-in areas. This is a UX convenience only — the
 * API enforces authentication and roles on every request.
 */
export function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();

  if (status === 'initializing') return <FullPageLoader />;
  if (status === 'anonymous' || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}

/** Sign-in/registration pages: signed-in users go straight to their home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'initializing') return <FullPageLoader />;
  if (status === 'authenticated' && user) return <Navigate to={homePathFor(user.role)} replace />;
  return children;
}
