import { UpdateUserSchema } from '@orchestra/schemas';
import { createZodDto } from 'nestjs-zod';

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
