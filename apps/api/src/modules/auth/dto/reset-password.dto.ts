import { createZodDto } from 'nestjs-zod';
import { ResetPasswordSchema } from '@orchestra/schemas';

export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
