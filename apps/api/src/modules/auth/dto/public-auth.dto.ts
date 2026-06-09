import { PublicAuthSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class PublicAuthDto extends createZodDto(PublicAuthSchema) {}
