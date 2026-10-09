import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { DashboardPage } from '@/pages/app/DashboardPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { BusinessDashboardPage } from '@/pages/business/BusinessDashboardPage';
import { NotFoundPage } from '@/pages/errors/NotFoundPage';
import { RouteErrorPage } from '@/pages/errors/RouteErrorPage';
import { ProfilePage } from '@/pages/profile/ProfilePage';
import { WelcomePage } from '@/pages/public/WelcomePage';
import { GuestOnly, RequireAuth } from './guards';

export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicLayout />,
        children: [{ index: true, element: <WelcomePage /> }],
      },
      {
        element: (
          <GuestOnly>
            <AuthLayout />
          </GuestOnly>
        ),
        children: [
          { path: 'login', element: <LoginPage /> },
          { path: 'register', element: <RegisterPage /> },
        ],
      },
      {
        element: (
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        ),
        children: [
          {
            path: 'app',
            element: (
              <RequireAuth roles={['USER']}>
                <DashboardPage />
              </RequireAuth>
            ),
          },
          {
            path: 'business',
            element: (
              <RequireAuth roles={['BUSINESS']}>
                <BusinessDashboardPage />
              </RequireAuth>
            ),
          },
          {
            path: 'admin',
            element: (
              <RequireAuth roles={['ADMIN']}>
                <AdminDashboardPage />
              </RequireAuth>
            ),
          },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
      {
        element: <PublicLayout />,
        children: [{ path: '*', element: <NotFoundPage /> }],
      },
    ],
  },
]);
