import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@orchestra/schemas';
import { AppException } from './app.exception';

export class RateLimitedException extends AppException {
  constructor(
    message = 'Muitas requisições. Tente novamente em instantes.',
    details?: Record<string, unknown>,
  ) {
    super(
      ErrorCode.RateLimited,
      HttpStatus.TOO_MANY_REQUESTS,
      message,
      details,
    );
  }
}
