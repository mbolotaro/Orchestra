import { PublicAuthSessionListSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class PublicAuthSessionListDto extends createZodDto(
  PublicAuthSessionListSchema,
) {}
