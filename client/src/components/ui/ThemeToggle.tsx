import { Monitor, Moon, Sun } from 'lucide-react';
import { useUiStore, type ThemePreference } from '@/store/uiStore';
import { cn } from '@/utils/cn';

const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn('inline-flex rounded-xl border border-border bg-surface p-0.5', className)}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'inline-flex size-8 items-center justify-center rounded-[0.6rem] text-fg-muted transition-colors',
            theme === value ? 'bg-primary-soft text-primary-soft-fg' : 'hover:text-fg',
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
