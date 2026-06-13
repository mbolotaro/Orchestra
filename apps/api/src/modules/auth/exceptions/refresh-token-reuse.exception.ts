import { UnauthorizedException } from '@nestjs/common';

export class RefreshTokenReuseException extends UnauthorizedException {
  constructor() {
    super('Refresh token comprometido.');
  }
}
