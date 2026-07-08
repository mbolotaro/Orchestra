import { z } from 'zod';

type Duration = `${number}${'s' | 'm' | 'h' | 'd'}`;

const duration = (defaultValue: Duration) =>
  z
    .string()
    .regex(/^\d+[smhd]$/, 'Invalid duration format!')
    .default(defaultValue)
    .transform((v): Duration => v as Duration);

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('test'),

  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_PORT: z.string().regex(/^\d+$/, 'DB_PORT must be a number'),
  DB_HOST: z.string().optional(),

  EMAIL_VERIFICATION_PEPPER: z.string().min(32),
  EMAIL_VERIFICATION_EXPIRATION: duration('24h'),

  PASSWORD_RESET_PEPPER: z.string().min(32),
  PASSWORD_RESET_EXPIRATION: duration('1h'),

  EMAIL_API_KEY: z.string(),
  EMAIL: z.email(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().regex(/^\d+$/, 'REDIS_PORT must be a number'),
  REDIS_PASSWORD: z
    .string()
    .min(32, 'REDIS_PASSWORD must be at least 32 characters'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRATION: duration('15m'),
  JWT_REFRESH_EXPIRATION: duration('7d'),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  OAUTH_CALLBACK_BASE: z.url(),

  FRONTEND_URL: z.url(),
});

export type AppEnv = z.infer<typeof EnvSchema>;
