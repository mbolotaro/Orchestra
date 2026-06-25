import { ForgotPasswordSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
