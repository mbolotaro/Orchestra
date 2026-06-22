import { VerifyEmailSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class VerifyEmailDto extends createZodDto(VerifyEmailSchema) {}
