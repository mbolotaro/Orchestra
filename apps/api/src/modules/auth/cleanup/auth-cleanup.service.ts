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
export class AuthCleanupService implements CleanupTask, OnModuleInit {
  readonly name = 'auth';
  private readonly logger = new Logger(AuthCleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CleanupRegistry,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async run(): Promise<CleanupTaskResult> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    const deleted: Record<string, number> = {};

    const targets = [
      {
        key: 'authLogs',
        fn: () =>
          this.prisma.authLog.deleteMany({
            where: { occurredAt: { lt: cutoff } },
          }),
      },
      {
        key: 'refreshTokens',
        fn: () =>
          this.prisma.refreshToken.deleteMany({
            where: { revokedAt: { not: null, lt: cutoff } },
          }),
      },
      {
        key: 'emailVerificationTokens',
        fn: () =>
          this.prisma.emailVerificationToken.deleteMany({
            where: { createdAt: { lt: cutoff } },
          }),
      },
      {
        key: 'passwordResetTokens',
        fn: () =>
          this.prisma.passwordResetToken.deleteMany({
            where: { createdAt: { lt: cutoff } },
          }),
      },
    ];

    for (const target of targets) {
      try {
        const { count } = await target.fn();
        deleted[target.key] = count;
      } catch (err) {
        this.logger.error(
          `Failed to clean ${target.key}: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err.stack : undefined,
        );
        deleted[target.key] = 0;
      }
    }

    return { deleted };
  }
}
