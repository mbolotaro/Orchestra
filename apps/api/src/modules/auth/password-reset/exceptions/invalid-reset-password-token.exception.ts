import { ErrorCode } from '@orchestra/schemas';
import { AppException } from '../../../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

export class InvalidResetPasswordTokenException extends AppException {
  constructor(
    public readonly userId?: string,
    public readonly email?: string,
  ) {
    super(
      ErrorCode.InvalidResetPasswordToken,
      HttpStatus.FORBIDDEN,
      'Token de alteração de senha inválido ou vencido.',
    );
  }
}
