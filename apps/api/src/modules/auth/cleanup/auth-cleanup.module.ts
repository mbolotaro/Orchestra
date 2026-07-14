import { Module } from '@nestjs/common';
import { CleanupModule } from '../../cleanup/cleanup.module';
import { AuthCleanupService } from './auth-cleanup.service';

@Module({
  imports: [CleanupModule],
  providers: [AuthCleanupService],
  exports: [AuthCleanupService],
})
export class AuthCleanupModule {}
