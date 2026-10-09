import { Outlet } from 'react-router';
import { DemoBanner } from '@/components/feedback/DemoBanner';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { MobileNav } from '@/components/layout/MobileNav';
import { Sidebar } from '@/components/layout/Sidebar';

/** Signed-in shell: sidebar on desktop, header + bottom tabs on mobile. */
export function AppLayout() {
  return (
    <div className="min-h-dvh [--banner-h:1.75rem]">
      <a
        href="#main"
        className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-10 focus:left-3"
      >
        Skip to content
      </a>
      <DemoBanner />
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <MobileHeader />
          <main
            id="main"
            className="mx-auto w-full max-w-5xl px-4 pt-2 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-12"
          >
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
