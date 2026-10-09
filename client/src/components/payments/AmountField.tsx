import { BRAND } from '@/config/brand';
import { cn } from '@/utils/cn';

/** Keeps digits and a single decimal point with at most two decimals. */
function sanitize(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [whole = '', ...rest] = cleaned.split('.');
  const fraction = rest.join('').slice(0, 2);
  const trimmedWhole = whole.replace(/^0+(?=\d)/, '').slice(0, 9);
  return rest.length > 0 ? `${trimmedWhole || '0'}.${fraction}` : trimmedWhole;
}

/** Display-only grouping while typing ("12500" → "12,500"). */
function group(value: string): string {
  const [whole = '', fraction] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction !== undefined ? `${grouped}.${fraction}` : grouped;
}

interface AmountFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}

/** Large, centred amount input. The value is a plain decimal string ("1500.5"). */
export function AmountField({ id, value, onChange, invalid, describedBy }: AmountFieldProps) {
  return (
    <div className="flex items-baseline justify-center gap-2">
      <span className="text-2xl font-bold text-fg-muted" aria-hidden="true">
        {BRAND.currency.symbol}
      </span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoFocus
        placeholder="0"
        value={group(value)}
        onChange={(event) => onChange(sanitize(event.target.value))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-label={`Amount in ${BRAND.currency.code}`}
        className={cn(
          'w-full max-w-[11ch] bg-transparent text-center text-5xl font-extrabold tracking-tight tabular-nums outline-none placeholder:text-fg-subtle sm:text-6xl',
          invalid && 'text-danger',
        )}
        style={{ width: `${Math.max(2, group(value).length + 1)}ch` }}
      />
    </div>
  );
}
