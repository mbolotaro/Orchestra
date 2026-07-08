import { Module } from '@nestjs/common';
import { PasswordResetTokenService } from './password-reset-token.service';

@Module({
  providers: [PasswordResetTokenService],
  exports: [PasswordResetTokenService],
})
export class PasswordResetModule {}
