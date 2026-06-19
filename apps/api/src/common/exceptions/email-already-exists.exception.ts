import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@orchestra/schemas';
import { AppException } from './app.exception';

export class EmailAlreadyExistsException extends AppException {
  constructor() {
    super(
      ErrorCode.EmailAlreadyExists,
      HttpStatus.CONFLICT,
      'Já existe um usuário com este e-mail cadastrado.',
      { field: 'email' },
    );
  }
}
