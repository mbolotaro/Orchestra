import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CLEANUP_QUEUE } from './cleanup.constant';
import { CleanupProcessor } from './cleanup.processor';
import { CleanupRegistry } from './cleanup.registry';
import { CleanupSchedulerService } from './cleanup-scheduler.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: CLEANUP_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      },
    }),
  ],
  providers: [CleanupRegistry, CleanupProcessor, CleanupSchedulerService],
  exports: [CleanupRegistry],
})
export class CleanupModule {}
