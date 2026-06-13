import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { EnvService } from '../env/env.service';
import { SessionInfoPayload } from './types/session-info.type';
import { IssuedRefresh } from './types/issued-refresh.type';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '../../generated/prisma/client';
import { durationToMs } from '../../common/helpers/parse-duration.helper';
import { RefreshTokenReuseException } from './exceptions/refresh-token-reuse.exception';
import { TransactionClient } from '../../generated/prisma/internal/prismaNamespace';

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly tokenService: TokenService,
    private readonly env: EnvService,
  ) {}

  async issue(
    userId: string,
    session: SessionInfoPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<IssuedRefresh> {
    try {
      const jti = randomUUID();
      const token = await this.tokenService.signRefresh(userId, jti);
      const tokenHash = await bcrypt.hash(token, 12);
      const expiresAt = this.computeExpiresAt();

      const client: Prisma.TransactionClient = tx ?? this.prismaService;

      await client.refreshToken.create({
        data: {
          jti,
          userId,
          tokenHash,
          expiresAt,
          userAgent: session.userAgent,
          ipAddress: session.ip,
        },
      });

      return { token, jti };
    } catch (error) {
      this.logger.error({ error, userId }, 'issue');

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível salvar refresh token.',
      );
    }
  }

  async rotate(
    rawToken: string,
    session: SessionInfoPayload,
    tx?: TransactionClient,
  ): Promise<IssuedRefresh & { userId: string }> {
    try {
      const client = tx ?? this.prismaService;
      const payload = await this.tokenService.verifyRefresh(rawToken);

      const record = await client.refreshToken.findUnique({
        where: { jti: payload.jti },
      });

      if (!record) {
        throw new UnauthorizedException('Refresh token inválido.');
      }

      if (record.revokedAt) {
        this.logger.warn(
          { jti: record.jti, userId: record.userId },
          'Refresh token already used. Revoking all tokens...',
        );

        await this.revokeAllForUser(record.userId);

        throw new RefreshTokenReuseException();
      }

      if (record.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expirado.');
      }

      const hashMatches = await bcrypt.compare(rawToken, record.tokenHash);

      if (!hashMatches)
        throw new UnauthorizedException('Refresh token inválido.');

      return await client.$transaction(async (tx) => {
        const issued = await this.issue(record.userId, session, tx);

        await tx.refreshToken.update({
          where: { jti: record.jti },
          data: { revokedAt: new Date(), replacedBy: issued.jti },
        });

        return { ...issued, userId: record.userId };
      });
    } catch (error) {
      this.logger.error({ error }, 'rotate');

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível atualizar refresh token.',
      );
    }
  }

  async revoke(jti: string): Promise<void> {
    try {
      await this.prismaService.refreshToken.updateMany({
        where: { jti, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      this.logger.error({ error, jti }, 'revoke');

      throw new InternalServerErrorException(
        'Não foi possível revogar refresh token.',
      );
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    try {
      await this.prismaService.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (error) {
      this.logger.error({ error, userId }, 'revokeAllForUser');

      throw new InternalServerErrorException(
        'Não foi possível revogar refresh tokens do usuário.',
      );
    }
  }

  private computeExpiresAt(): Date {
    return new Date(
      Date.now() + durationToMs(this.env.get('JWT_REFRESH_EXPIRATION')),
    );
  }
}
