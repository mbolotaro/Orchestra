import { SignUpSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class SignUpDto extends createZodDto(SignUpSchema) {}
