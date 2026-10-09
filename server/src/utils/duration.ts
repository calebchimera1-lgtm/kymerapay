const UNIT_SECONDS = { s: 1, m: 60, h: 3_600, d: 86_400 } as const;

/** Parses durations such as `15m`, `1h` or `7d` into seconds. */
export function durationToSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  return Number(match[1]) * UNIT_SECONDS[match[2] as keyof typeof UNIT_SECONDS];
}
