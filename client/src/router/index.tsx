import type { Role } from '@app/shared';
import type { ReactElement } from 'react';
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
import { WalletPage } from '@/pages/wallet/WalletPage';
import { SendMoneyPage } from '@/pages/send/SendMoneyPage';
import { NewRequestPage } from '@/pages/requests/NewRequestPage';
import { RequestsPage } from '@/pages/requests/RequestsPage';
import { NewSplitPage } from '@/pages/split/NewSplitPage';
import { SplitDetailPage } from '@/pages/split/SplitDetailPage';
import { SplitListPage } from '@/pages/split/SplitListPage';
import { BusinessQrPage } from '@/pages/business/BusinessQrPage';
import { AnalyticsPage } from '@/pages/business/AnalyticsPage';
import { BusinessPaymentsPage } from '@/pages/business/BusinessPaymentsPage';
import { BusinessProfilePage } from '@/pages/business/BusinessProfilePage';
import { CustomersPage } from '@/pages/business/CustomersPage';
import { MyQrPage } from '@/pages/qr/MyQrPage';
import { PayLinkRedirect } from '@/pages/qr/PayLinkRedirect';
import { ScanPage } from '@/pages/qr/ScanPage';
import { GuestOnly, RequireAuth } from './guards';

/** Pages for one account type, each behind that role guard. */
function roleRoutes(role: Role, entries: [path: string, element: ReactElement][]) {
  return entries.map(([path, element]) => ({
    path,
    element: <RequireAuth roles={[role]}>{element}</RequireAuth>,
  }));
}

const userRoutes = (entries: [path: string, element: ReactElement][]) =>
  roleRoutes('USER', entries);

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
            path: 'app/wallet',
            element: (
              <RequireAuth roles={['USER']}>
                <WalletPage />
              </RequireAuth>
            ),
          },
          ...userRoutes([
            ['app/send', <SendMoneyPage />],
            ['app/requests', <RequestsPage />],
            ['app/requests/new', <NewRequestPage />],
            ['app/split', <SplitListPage />],
            ['app/split/new', <NewSplitPage />],
            ['app/split/:id', <SplitDetailPage />],
            ['app/pay', <SendMoneyPage audience="business" />],
            ['app/scan', <ScanPage />],
            ['app/qr', <MyQrPage />],
            ['pay/:code', <PayLinkRedirect />],
          ]),
          ...roleRoutes('BUSINESS', [
            ['business/qr', <BusinessQrPage />],
            ['business/payments', <BusinessPaymentsPage />],
            [
              'business/requests/new',
              <NewRequestPage listPath="/business/payments" homePath="/business" />,
            ],
            ['business/customers', <CustomersPage />],
            ['business/analytics', <AnalyticsPage />],
            ['business/profile', <BusinessProfilePage />],
          ]),
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
