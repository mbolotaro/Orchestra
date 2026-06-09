import { PublicUserSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class PublicUserDto extends createZodDto(PublicUserSchema) {}
