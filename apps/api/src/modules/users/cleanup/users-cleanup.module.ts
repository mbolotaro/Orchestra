import { Module } from '@nestjs/common';
import { CleanupModule } from '../../cleanup/cleanup.module';
import { UsersCleanupService } from './users-cleanup.service';

@Module({
  imports: [CleanupModule],
  providers: [UsersCleanupService],
})
export class UsersCleanupModule {}
