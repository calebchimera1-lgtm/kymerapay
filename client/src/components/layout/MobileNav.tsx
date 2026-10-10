import { NavLink } from 'react-router';
import { mobileNavFor } from '@/config/navigation';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';

/** Bottom tab bar on phones and small tablets. */
export function MobileNav() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  const items = mobileNavFor(user.role);

  return (
    <nav
      aria-label="Main"
      className="print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul
        className="mx-auto grid max-w-md"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map(({ label, to, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-primary' : 'text-fg-muted hover:text-fg',
                )
              }
            >
              <Icon className="size-[22px]" aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
