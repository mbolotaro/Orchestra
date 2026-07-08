import { ErrorCode } from '@orchestra/schemas';
import { AppException } from '../../../../common/exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';

export class InvalidVerifyTokenException extends AppException {
  constructor(
    public readonly userId?: string,
    public readonly email?: string,
  ) {
    super(
      ErrorCode.InvalidVerifyToken,
      HttpStatus.FORBIDDEN,
      'Token de verificação inválido ou vencido.',
    );
  }
}
