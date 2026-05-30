import { z } from 'zod';

export const EnvSchema = z.object({
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_NAME: z.string().min(1),
  DB_PORT: z.string().regex(/^\d+$/, 'DB_PORT must be a number'),
  DB_HOST: z.string().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;
