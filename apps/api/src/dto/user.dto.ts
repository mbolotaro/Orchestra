import { createZodDto } from 'nestjs-zod';
import { CreateUserSchema } from '@orchestra/schemas';

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
