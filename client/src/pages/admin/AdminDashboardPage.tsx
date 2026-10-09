import { ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/feedback/EmptyState';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/store/authStore';

export function AdminDashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  return (
    <div>
      <PageHeader
        title="Platform overview"
        description={`Signed in as @${user.username} (administrator)`}
      />
      <Card>
        <EmptyState
          icon={ShieldCheck}
          title="Admin tools are on the way"
          description="User management, system statistics and the audit log arrive in a later build phase."
        />
      </Card>
    </div>
  );
}
