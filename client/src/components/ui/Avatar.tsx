import { cn } from '@/utils/cn';

const sizes = {
  sm: 'size-8 text-xs',
  md: 'size-10 text-sm',
  lg: 'size-16 text-xl',
  xl: 'size-24 text-3xl',
} as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const base = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
    sizes[size],
    className,
  );
  if (src) return <img src={src} alt="" className={cn(base, 'object-cover')} />;
  return (
    <span aria-hidden="true" className={cn(base, 'bg-primary-soft text-primary-soft-fg')}>
      {initials(name)}
    </span>
  );
}
