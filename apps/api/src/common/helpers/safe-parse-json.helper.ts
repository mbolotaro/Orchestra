import z from 'zod';

export function safeParseJson<T>(json: string, schema: z.ZodType<T>): T | null;
export function safeParseJson<T>(
  json: string,
  schema: z.ZodType<T>,
  fallback: T,
): T;
export function safeParseJson<T>(
  json: string,
  schema: z.ZodType<T>,
  fallback: T | null = null,
): T | null {
  try {
    const parsed: unknown = JSON.parse(json);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}
