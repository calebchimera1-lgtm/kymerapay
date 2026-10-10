import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/store/authStore';

export function MobileHeader() {
  const user = useAuthStore((state) => state.user);
  if (!user) return null;
  return (
    <header className="print:hidden flex items-center justify-between px-4 py-3 lg:hidden">
      <Logo />
      <Link to="/profile" aria-label="Your profile" className="rounded-full">
        <Avatar name={user.fullName} src={user.avatarUrl} size="sm" />
      </Link>
    </header>
  );
}
