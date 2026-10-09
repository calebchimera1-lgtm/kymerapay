import { BRAND } from '@/config/brand';

const hourFormatter = new Intl.DateTimeFormat('en-KE', {
  hour: 'numeric',
  hourCycle: 'h23',
  timeZone: BRAND.timezone,
});

/** "Good morning/afternoon/evening" in Nairobi time, regardless of device timezone. */
export function greetingFor(date = new Date()): string {
  const hour = Number(hourFormatter.format(date));
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const monthYear = new Intl.DateTimeFormat('en-KE', {
  month: 'short',
  year: 'numeric',
  timeZone: BRAND.timezone,
});

export function formatMonthYear(iso: string): string {
  return monthYear.format(new Date(iso));
}
