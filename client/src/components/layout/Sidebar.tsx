import { LogOut } from 'lucide-react';
import { NavLink } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { sidebarFor } from '@/config/navigation';
import { useSignOut } from '@/hooks/useSignOut';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';

/** Desktop/tablet navigation (lg and up). */
export function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const { signOut, pending } = useSignOut();
  if (!user) return null;

  return (
    <aside className="print:hidden sticky top-[var(--banner-h)] hidden h-[calc(100dvh-var(--banner-h))] w-64 shrink-0 flex-col border-r border-border bg-surface lg:flex">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {sidebarFor(user.role).map(({ label, to, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end
                className={({ isActive }) =>
                  cn(
                    'flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary-soft text-primary-soft-fg'
                      : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                  )
                }
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.fullName}</p>
            <p className="truncate text-xs text-fg-muted">@{user.username}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            disabled={pending}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted hover:bg-surface-muted hover:text-danger disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
