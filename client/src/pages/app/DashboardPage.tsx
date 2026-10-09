import { BeadPattern } from '@/components/brand/BeadPattern';
import { AccountReadyCard } from '@/components/layout/AccountReadyCard';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuthStore } from '@/store/authStore';
import { formatMonthYear, greetingFor } from '@/utils/dates';

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)!;
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greetingFor()}, ${firstName} 👋`}
        description="Here's your demo wallet."
      />

      <section
        aria-label="Wallet"
        className="relative overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-fg shadow-raised sm:p-8"
      >
        <BeadPattern className="text-primary-fg opacity-[0.08]" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">KES Wallet</p>
            <p className="font-semibold">@{user.username}</p>
          </div>
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
            Demo
          </span>
        </div>
        <p className="relative mt-8 text-sm opacity-85">
          Wallet opened {formatMonthYear(user.createdAt)}. Your balance and payments appear here in
          the next release.
        </p>
      </section>

      <AccountReadyCard
        steps={[
          { label: 'Account created', done: true },
          { label: 'KES wallet opened', done: true },
          { label: 'Payment PIN set', done: true },
          { label: 'Send, request and split money', done: false },
        ]}
      />
    </div>
  );
}
