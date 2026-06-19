import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@orchestra/schemas';
import { AppException } from './app.exception';

export class InvalidCredentialsException extends AppException {
  constructor() {
    super(
      ErrorCode.InvalidCredentials,
      HttpStatus.UNAUTHORIZED,
      'Credenciais inválidas.',
    );
  }
}
