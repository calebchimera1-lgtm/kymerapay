import {
  ArrowDownLeft,
  ArrowUpRight,
  QrCode,
  ScanLine,
  ShieldCheck,
  Split,
  Store,
  Users,
} from 'lucide-react';
import { BeadPattern } from '@/components/brand/BeadPattern';
import { Badge } from '@/components/ui/Badge';
import { BRAND } from '@/config/brand';
import { SystemStatusCard } from './SystemStatusCard';

const features = [
  {
    Icon: ArrowUpRight,
    title: 'Send instantly',
    text: 'Pay anyone by @username with a confirmation step and PIN.',
  },
  {
    Icon: ArrowDownLeft,
    title: 'Request money',
    text: 'Ask friends to pay you back and track who has paid.',
  },
  {
    Icon: Split,
    title: 'Split bills',
    text: 'Divide a restaurant bill fairly, down to the last cent.',
  },
  {
    Icon: ScanLine,
    title: 'Scan & pay',
    text: 'Scan a QR code to open a pre-filled, confirm-first payment.',
  },
  {
    Icon: Store,
    title: 'Business tools',
    text: 'Accept payments, issue receipts and watch daily sales.',
  },
  {
    Icon: Users,
    title: 'Private by default',
    text: 'You choose who sees your activity. Balances stay private.',
  },
];

export function WelcomePage() {
  return (
    <div className="space-y-12 pt-4 sm:pt-10">
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-rise-in space-y-6">
          <Badge tone="accent">
            <ShieldCheck className="size-3.5" aria-hidden="true" /> Sandbox · simulated KES only
          </Badge>
          <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Money between friends,
            <span className="block text-primary">made simple.</span>
          </h1>
          <p className="max-w-xl text-lg text-fg-muted">{BRAND.tagline}</p>
          <p className="max-w-xl text-sm text-fg-muted">
            Accounts, sign-in and the wallet arrive in the next build phases. This preview shows the
            platform foundation and live API status.
          </p>
        </div>

        <PreviewWalletCard />
      </section>

      <section aria-labelledby="features-heading" className="space-y-5">
        <h2 id="features-heading" className="text-xl font-bold tracking-tight">
          What you will be able to do
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ Icon, title, text }) => (
            <li
              key={title}
              className="rounded-card border border-border bg-surface p-5 shadow-card"
            >
              <span className="mb-3 inline-flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-fg">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-fg-muted">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      <SystemStatusCard />
    </div>
  );
}

/** Illustrative balance card with obviously sample figures. */
function PreviewWalletCard() {
  return (
    <figure
      aria-label="Example wallet card with sample data"
      className="relative animate-rise-in overflow-hidden rounded-[1.75rem] bg-primary p-6 text-primary-fg shadow-raised sm:p-8"
    >
      <BeadPattern className="text-primary-fg opacity-[0.08]" />
      <div className="relative space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm opacity-80">KES Wallet</p>
            <p className="text-sm font-semibold">@caleb254</p>
          </div>
          <span className="rounded-full bg-black/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
            Sample
          </span>
        </div>
        <div>
          <p className="text-sm opacity-80">Available balance</p>
          <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
            {BRAND.currency.symbol} 24,850.00
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          {[
            { Icon: ArrowUpRight, label: 'Send' },
            { Icon: ArrowDownLeft, label: 'Request' },
            { Icon: ScanLine, label: 'Scan' },
            { Icon: QrCode, label: 'Pay' },
          ].map(({ Icon, label }) => (
            <span key={label} className="flex flex-col items-center gap-1.5">
              <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-white/15">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">Sample figures only — not a real account.</figcaption>
    </figure>
  );
}
