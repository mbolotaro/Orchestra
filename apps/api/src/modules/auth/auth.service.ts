import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotImplementedException,
} from '@nestjs/common';
import { SignUpDto } from './dto/signup.dto';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionInfoPayload } from './types/session-info.type';
import { AuthLogsService } from './auth-logs.service';
import { AuthStatus } from '../../generated/prisma/enums';
import { RefreshTokenService } from './refresh-token.service';
import { TokenService } from './token.service';
import { Response } from 'express';
import { AuthSession } from './types/auth-session.type';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly authLogService: AuthLogsService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
  ) {}

  async signUp(
    signUpDto: SignUpDto,
    session: SessionInfoPayload,
  ): Promise<AuthSession> {
    const now = new Date();

    try {
      const passwordHash = await bcrypt.hash(signUpDto.password, 12);

      const { user, refreshToken } = await this.prismaService.$transaction(
        async (tx) => {
          const user = await this.usersService.create(
            {
              kind: 'password',
              firstName: signUpDto.firstName,
              lastName: signUpDto.lastName,
              email: signUpDto.email,
              passwordHash,
            },
            tx,
          );

          await this.authLogService.recordSignUpLog(
            {
              email: user.email,
              userId: user.id,
              ipAddress: session.ip,
              userAgent: session.userAgent,
              status: AuthStatus.Success,
              occurredAt: now,
            },
            tx,
          );

          const { token: refreshToken } = await this.refreshTokenService.issue(
            user.id,
            session,
            tx,
          );

          return { user, refreshToken };
        },
      );

      const accessToken = await this.tokenService.signAccess(user.id);

      return {
        accessToken,
        refreshToken,
        user,
      };
    } catch (error) {
      this.logger.error({ error, email: signUpDto.email }, 'signUp');

      await this.authLogService
        .recordSignUpLog({
          email: signUpDto.email,
          status: AuthStatus.Failed,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'signUp'),
        );

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível registrar usuário.',
      );
    }
  }

  signIn() {
    throw new NotImplementedException('');
  }
}
