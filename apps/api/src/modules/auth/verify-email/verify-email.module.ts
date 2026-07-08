import { Module } from '@nestjs/common';
import { VerifyEmailTokenService } from './verify-email-token.service';

@Module({
  providers: [VerifyEmailTokenService],
  exports: [VerifyEmailTokenService],
})
export class VerifyEmailModule {}
