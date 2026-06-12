import { SignInSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class SignInDto extends createZodDto(SignInSchema) {}
