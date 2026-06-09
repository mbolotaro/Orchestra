const MULTIPLIERS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };

export function durationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/)!;

  const value = parseInt(match[1], 10);
  return value * MULTIPLIERS[match[2] as keyof typeof MULTIPLIERS];
}
