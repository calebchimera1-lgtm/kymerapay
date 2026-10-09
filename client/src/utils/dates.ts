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

const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRAND.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeOfDay = new Intl.DateTimeFormat('en-KE', {
  timeZone: BRAND.timezone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const dayMonth = new Intl.DateTimeFormat('en-KE', {
  timeZone: BRAND.timezone,
  day: '2-digit',
  month: 'short',
});

/** "Today, 06:20" · "Yesterday, 14:02" · "08 Oct, 06:42" (Nairobi time). */
export function formatActivityTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  const key = dayKey.format(date);
  const time = timeOfDay.format(date);
  if (key === dayKey.format(now)) return `Today, ${time}`;
  if (key === dayKey.format(new Date(now.getTime() - 86_400_000))) return `Yesterday, ${time}`;
  return `${dayMonth.format(date)}, ${time}`;
}

/** "2026-10-08" → "8 Oct" for chart axes. */
export function formatShortDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-KE', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year!, month! - 1, day!)));
}
