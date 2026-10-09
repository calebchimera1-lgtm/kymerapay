import { formatMoney } from '@app/shared';
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, QrCode, RotateCw, ScanLine } from 'lucide-react';
import { BeadPattern } from '@/components/brand/BeadPattern';
import { useWallet } from '@/hooks/useWallet';
import { useAuthStore } from '@/store/authStore';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';

const QUICK_ACTIONS = [
  { label: 'Send', Icon: ArrowUpRight },
  { label: 'Request', Icon: ArrowDownLeft },
  { label: 'Scan', Icon: ScanLine },
  { label: 'Pay', Icon: QrCode },
] as const;

/**
 * The wallet hero. The balance shown is exactly the string the server sent —
 * the client never computes or adjusts it.
 */
export function BalanceCard({ showActions = true }: { showActions?: boolean }) {
  const user = useAuthStore((state) => state.user)!;
  const wallet = useWallet();
  const hidden = useUiStore((state) => state.hideBalances);
  const toggleHidden = useUiStore((state) => state.toggleHideBalances);

  return (
    <section
      aria-label="Wallet balance"
      className="relative overflow-hidden rounded-[1.75rem] bg-hero p-6 text-hero-fg shadow-raised sm:p-8"
    >
      <BeadPattern className="text-hero-fg opacity-[0.08]" />
      <div className="relative space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm opacity-80">KES Wallet</p>
            <p className="font-semibold">@{user.username}</p>
          </div>
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase">
            Demo
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm opacity-80">Available balance</p>
            <button
              type="button"
              onClick={toggleHidden}
              aria-pressed={hidden}
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
              className="inline-flex size-7 items-center justify-center rounded-full opacity-80 hover:bg-white/15 hover:opacity-100"
            >
              {hidden ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <div className="mt-1 min-h-12 sm:min-h-14" aria-live="polite">
            {wallet.isPending ? (
              <div
                className="h-11 w-56 animate-pulse rounded-xl bg-white/20 sm:h-13"
                aria-label="Loading balance"
              />
            ) : wallet.isError ? (
              <button
                type="button"
                onClick={() => void wallet.refetch()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
              >
                <RotateCw
                  className={cn('size-4', wallet.isFetching && 'animate-spin')}
                  aria-hidden="true"
                />
                Couldn’t load balance — retry
              </button>
            ) : (
              <p className="text-[clamp(1.75rem,9vw,3rem)] leading-tight font-extrabold tracking-tight tabular-nums">
                {hidden ? (
                  <span aria-label="Balance hidden">KSh ••••••</span>
                ) : (
                  formatMoney(wallet.data.balance)
                )}
              </p>
            )}
          </div>
          {wallet.data?.status === 'FROZEN' && (
            <p className="mt-2 inline-block rounded-lg bg-black/20 px-2.5 py-1 text-xs font-semibold">
              Wallet frozen — payments are disabled
            </p>
          )}
        </div>

        {showActions && (
          <ul className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
            {QUICK_ACTIONS.map(({ label, Icon }) => (
              <li key={label}>
                <span
                  aria-disabled="true"
                  title="Available in the next release"
                  className="flex cursor-not-allowed flex-col items-center gap-1.5 opacity-70"
                >
                  <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/15">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {label}
                  <span className="sr-only">(coming soon)</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
