const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function msToHuman(ms: number): string {
  if (ms <= 0) return '0s';

  let remaining = ms;

  const days = Math.floor(remaining / DAY);
  remaining -= days * DAY;

  const hours = Math.floor(remaining / HOUR);
  remaining -= hours * HOUR;

  const minutes = Math.floor(remaining / MINUTE);
  remaining -= minutes * MINUTE;

  const seconds = Math.floor(remaining / SECOND);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}hrs`);
  if (minutes > 0) parts.push(`${minutes}min`);
  if (seconds > 0) parts.push(`${seconds}s`);

  return parts.length ? parts.join(' ') : '0s';
}
