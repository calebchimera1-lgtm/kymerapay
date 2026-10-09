import { Link, Outlet } from 'react-router';
import { BeadPattern } from '@/components/brand/BeadPattern';
import { Logo } from '@/components/brand/Logo';
import { DemoBanner } from '@/components/feedback/DemoBanner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { BRAND } from '@/config/brand';

/** Split-screen on desktop (brand panel + form), single column on mobile. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="grid flex-1 lg:grid-cols-[1fr_1.1fr]">
        <aside className="relative hidden overflow-hidden bg-hero p-12 text-hero-fg lg:flex lg:flex-col lg:justify-between">
          <BeadPattern className="text-hero-fg opacity-[0.07]" />
          <Link to="/" className="relative w-fit rounded-xl text-hero-fg">
            <Logo />
          </Link>
          <div className="relative max-w-md space-y-4">
            <h2 className="text-4xl leading-tight font-extrabold tracking-tight">
              Pay friends and businesses in seconds.
            </h2>
            <p className="text-lg opacity-85">{BRAND.tagline}</p>
          </div>
          <p className="relative max-w-md text-xs leading-relaxed opacity-75">
            {BRAND.demo.legalNotice}
          </p>
        </aside>

        <div className="flex flex-col">
          <header className="flex items-center justify-between px-4 py-4 sm:px-8">
            <Link to="/" className="rounded-xl lg:invisible">
              <Logo />
            </Link>
            <ThemeToggle />
          </header>
          <main
            id="main"
            className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 sm:px-8 sm:pt-10"
          >
            <div className="w-full max-w-md animate-rise-in">
              <Outlet />
            </div>
          </main>
          <footer className="px-4 pb-6 text-center text-xs text-fg-muted sm:px-8 lg:hidden">
            {BRAND.demo.disclaimer}
          </footer>
        </div>
      </div>
    </div>
  );
}
