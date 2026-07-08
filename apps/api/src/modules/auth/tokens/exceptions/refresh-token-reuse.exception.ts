import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@orchestra/schemas';
import { AppException } from '../../../../common/exceptions/app.exception';

export class RefreshTokenReuseException extends AppException {
  constructor() {
    super(
      ErrorCode.RefreshTokenReuse,
      HttpStatus.UNAUTHORIZED,
      'Sessão comprometida. Faça login novamente.',
    );
  }
}
