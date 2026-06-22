import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EnvService } from '../env/env.service';
import { Prisma } from '../../generated/prisma/client';
import { createHash, randomBytes } from 'crypto';
import { durationToMs } from '../../common/helpers/parse-duration.helper';
import { InvalidVerifyTokenException } from './exceptions/invalid-verify-token.exception';
import {
  IssueVerifyEmailResponse,
  VerifyEmailTokenPayload,
} from './types/verify-token.type';

@Injectable()
export class EmailVerificationTokenService {
  private readonly logger = new Logger(EmailVerificationTokenService.name);

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
      this.logger.error({ error }, 'issue');

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
