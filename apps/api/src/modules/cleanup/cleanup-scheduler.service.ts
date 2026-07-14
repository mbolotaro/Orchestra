import { InjectQueue } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  CLEANUP_CRON,
  CLEANUP_JOB,
  CLEANUP_QUEUE,
  CLEANUP_SCHEDULER_ID,
} from './cleanup.constant';

@Injectable()
export class CleanupSchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(CleanupSchedulerService.name);

  constructor(@InjectQueue(CLEANUP_QUEUE) private readonly queue: Queue) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      CLEANUP_SCHEDULER_ID,
      { pattern: CLEANUP_CRON, tz: 'UTC' },
      {
        name: CLEANUP_JOB,
        data: {},
        opts: {
          removeOnComplete: { age: 7 * 24 * 3600, count: 100 },
          removeOnFail: { age: 30 * 24 * 3600 },
        },
      },
    );
    this.logger.log(
      `Cleanup scheduler upserted (id=${CLEANUP_SCHEDULER_ID}, cron="${CLEANUP_CRON}" UTC)`,
    );
  }
}
