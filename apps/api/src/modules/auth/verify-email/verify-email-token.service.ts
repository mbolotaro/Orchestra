import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EnvService } from '../../env/env.service';
import { Prisma } from '../../../generated/prisma/client';
import { createHash, randomBytes } from 'crypto';
import { durationToMs } from '../../../common/helpers/parse-duration.helper';
import { msToHuman } from '../../../common/helpers/ms-to-human.helper';
import { InvalidVerifyTokenException } from './exceptions/invalid-verify-token.exception';
import {
  IssueVerifyEmailResponse,
  VerifyEmailTokenPayload,
} from './types/verify-token.type';
import { RateLimitedException } from '../../../common/exceptions/rate-limited.exception';
import { VERIFY_EMAIL_COOLDOWN_MS } from '../auth.constants';

@Injectable()
export class VerifyEmailTokenService {
  private readonly logger = new Logger(VerifyEmailTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
  ) {}

  async issue(
    userId: string,
    email: string,
    tx?: Prisma.TransactionClient,
  ): Promise<IssueVerifyEmailResponse> {
    try {
      const client = tx ?? this.prisma;
      const now = new Date();
      const rawToken = randomBytes(32).toString('base64url');
      const tokenHash = this.hash(rawToken);
      const expiresAt = new Date(
        now.getTime() +
          durationToMs(this.env.get('EMAIL_VERIFICATION_EXPIRATION')),
      );

      const recent = await client.emailVerificationToken.findFirst({
        where: {
          userId,
          usedAt: null,
          createdAt: {
            gte: new Date(now.getTime() - VERIFY_EMAIL_COOLDOWN_MS),
          },
        },
      });

      if (recent) {
        const elapsedMs = now.getTime() - recent.createdAt.getTime();
        const remainingMs = VERIFY_EMAIL_COOLDOWN_MS - elapsedMs;
        throw new RateLimitedException(
          `Aguarde mais ${msToHuman(remainingMs)} para enviar outro email.`,
          { retryAfterSeconds: Math.ceil(remainingMs / 1000) },
        );
      }

      await client.$transaction(async (tx) => {
        await tx.emailVerificationToken.updateMany({
          where: { userId, usedAt: null },
          data: { usedAt: now },
        });

        await tx.emailVerificationToken.create({
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

  async consume(rawToken: string): Promise<VerifyEmailTokenPayload> {
    try {
      const tokenHash = this.hash(rawToken);
      const now = new Date();

      const record = await this.prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

      if (!record || record.usedAt || record.expiresAt < now)
        throw new InvalidVerifyTokenException(record?.userId, record?.email);

      await this.prisma.emailVerificationToken.update({
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

  hash(rawToken: string): string {
    const pepper = this.env.get('EMAIL_VERIFICATION_PEPPER');
    return createHash('sha256')
      .update(rawToken + pepper)
      .digest('hex');
  }
}
