import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CleanupRegistry } from '../../cleanup/cleanup.registry';
import type {
  CleanupTask,
  CleanupTaskResult,
} from '../../cleanup/types/cleanup-task.interface';

const RETENTION_DAYS = 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

@Injectable()
export class UsersCleanupService implements CleanupTask, OnModuleInit {
  readonly name = 'users';
  private readonly logger = new Logger(UsersCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CleanupRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async run(): Promise<CleanupTaskResult> {
    const cutoff = new Date(Date.now() - RETENTION_MS);

    try {
      const { count } = await this.hardDeleteStaleUsers(cutoff);
      return { deleted: { staleUsers: count } };
    } catch (err) {
      this.logger.error(
        `Failed to hard-delete stale users: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return { deleted: { staleUsers: 0 } };
    }
  }

  private async hardDeleteStaleUsers(cutoff: Date): Promise<{ count: number }> {
    const stale = await this.prisma.user.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    if (stale.length === 0) return { count: 0 };

    const userIds = stale.map((u) => u.id);

    return await this.prisma.$transaction(async (tx) => {
      await tx.authLog.updateMany({
        where: { userId: { in: userIds } },
        data: { userId: null },
      });
      const { count } = await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
      return { count };
    });
  }
}
