import { Outlet } from 'react-router';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { DemoBanner } from '@/components/feedback/DemoBanner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BRAND } from '@/config/brand';

/** Shell for signed-out pages: demo banner, header, content, legal footer. */
export function PublicLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" aria-label={`${BRAND.name} home`} className="rounded-xl">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 sm:px-6">
        <Outlet />
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-xs text-fg-muted sm:px-6">
          <p className="font-semibold text-fg">{BRAND.demo.disclaimer}</p>
          <p className="max-w-3xl leading-relaxed">{BRAND.demo.legalNotice}</p>
          <p>
            © {new Date().getFullYear()} {BRAND.name} · Software demonstration
          </p>
        </div>
      </footer>
    </div>
  );
}
