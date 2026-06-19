import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@orchestra/schemas';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    statusCode: HttpStatus,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super({ code, message, statusCode, details }, statusCode);
  }
}
