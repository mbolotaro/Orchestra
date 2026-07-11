import { z } from 'zod';
import { OAuthProviderSchema } from '@orchestra/schemas';

export const OAuthStatePayloadSchema = z.object({
  provider: OAuthProviderSchema,
  returnTo: z.string().optional(),
  createdAt: z.number(),
});

export type OAuthStatePayload = z.infer<typeof OAuthStatePayloadSchema>;
