import { AccountReadyCard } from '@/components/layout/AccountReadyCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuthStore } from '@/store/authStore';
import { greetingFor } from '@/utils/dates';

export function BusinessDashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor()} 👋`}
        description={user.business?.businessName ?? user.fullName}
      />
      <AccountReadyCard
        steps={[
          { label: 'Business account created', done: true },
          { label: 'Business wallet opened', done: true },
          { label: 'Accept QR payments', done: false },
          { label: 'Sales dashboard & receipts', done: false },
        ]}
      />
    </div>
  );
}
