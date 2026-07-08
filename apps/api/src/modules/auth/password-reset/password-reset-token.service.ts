import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnvService } from '../../env/env.service';
import {
  IssuePasswordResetResponse,
  ResetPasswordTokenPayload,
} from './types/password-reset-token.type';
import { Prisma } from '../../../generated/prisma/client';
import { createHash, randomBytes } from 'crypto';
import { durationToMs } from '../../../common/helpers/parse-duration.helper';
import { RESET_PASSWORD_COOLDOWN_MS } from '../auth.constants';
import { RateLimitedException } from '../../../common/exceptions/rate-limited.exception';
import { msToHuman } from '../../../common/helpers/ms-to-human.helper';
import { InvalidResetPasswordTokenException } from './exceptions/invalid-reset-password-token.exception';

@Injectable()
export class PasswordResetTokenService {
  private readonly logger = new Logger(PasswordResetTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  async issue(
    userId: string,
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<IssuePasswordResetResponse> {
    try {
      const client = tx ?? this.prisma;
      const now = new Date();
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = this.hash(rawToken);

      const expiresAt = new Date(
        now.getTime() + durationToMs(this.env.get('PASSWORD_RESET_EXPIRATION')),
      );

      const recent = await client.passwordResetToken.findFirst({
        where: {
          userId,
          usedAt: null,
          createdAt: { gte: new Date(now.getTime() - 60_000) },
        },
      });

      if (recent) {
        const elapsedMs = now.getTime() - recent.createdAt.getTime();
        const remainingMs = RESET_PASSWORD_COOLDOWN_MS - elapsedMs;
        throw new RateLimitedException(
          `Aguarde mais ${msToHuman(remainingMs)} para pedir nova redefinição.`,
        );
      }

      await client.$transaction(async (tx) => {
        await tx.passwordResetToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: now },
        });

        await tx.passwordResetToken.create({
          data: { userId, email, tokenHash, expiresAt },
        });
      });

      return { rawToken };
    } catch (error) {
      this.logger.error({ error, userId, email }, 'issue');

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível gerar verificador.',
      );
    }
  }

  async consume(rawToken: string): Promise<ResetPasswordTokenPayload> {
    try {
      const tokenHash = this.hash(rawToken);
      const now = new Date();

      const record = await this.prisma.passwordResetToken.findUnique({
        where: { tokenHash },
      });

      if (!record || record.usedAt || record.expiresAt < now)
        throw new InvalidResetPasswordTokenException(
          record?.userId,
          record?.email,
        );

      await this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      });

      return { userId: record.userId, email: record.email };
    } catch (error) {
      this.logger.error({ error }, 'consume');

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível verificar token.',
      );
    }
  }

  private hash(rawToken: string) {
    const pepper = this.env.get('PASSWORD_RESET_PEPPER');
    return createHash('sha256')
      .update(rawToken + pepper)
      .digest('hex');
  }
}
