import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { CLEANUP_QUEUE } from './cleanup.constant';
import { CleanupRegistry } from './cleanup.registry';

@Processor(CLEANUP_QUEUE)
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(private readonly registry: CleanupRegistry) {
    super();
  }

  async process(): Promise<void> {
    for (const task of this.registry.getAll()) {
      try {
        const result = await task.run();
        this.logger.log(
          `Cleanup "${task.name}" done: ${JSON.stringify(result.deleted)}`,
        );
      } catch (err) {
        this.logger.error(
          `Cleanup "${task.name}" failed: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
      }
    }
  }
}
