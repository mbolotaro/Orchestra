export const RATE_LIMIT_WINDOWS = {
  short: { limit: 10, ttl: 60_000 },
  medium: { limit: 60, ttl: 60_000 },
  long: { limit: 100, ttl: 300_000 },
  strict: { limit: 5, ttl: 900_000 },
  critical: { limit: 3, ttl: 3_600_000 },
} as const;

export type RateLimitWindow = keyof typeof RATE_LIMIT_WINDOWS;
export type RateLimitStrategy = 'ip' | 'email' | 'user';

export const RATE_LIMIT_METADATA_KEY = 'RATE_LIMIT_OPTIONS';

export interface RateLimitOptions {
  window: RateLimitWindow;
  by: RateLimitStrategy | RateLimitStrategy[];
}
