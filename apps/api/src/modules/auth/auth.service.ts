import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
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
import { SignInDto } from './dto/signin.dto';
import { PublicUserSchema } from '@orchestra/schemas';

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

  async signIn(
    signInDto: SignInDto,
    session: SessionInfoPayload,
  ): Promise<AuthSession> {
    const now = new Date();

    const DUMMY_HASH =
      '$2b$12$DzXeBdvtHyEMJQ76zwaJWeococKTIO3J4DF7ztsAlWzRY70/chUuG';

    const user = await this.usersService.findRawByEmail(signInDto.email);

    const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
    const passwordOk = await bcrypt.compare(signInDto.password, hashToCompare);

    if (!user || !user.passwordHash || !passwordOk) {
      const status: AuthStatus = !user
        ? AuthStatus.UserNotFound
        : !user.passwordHash
          ? AuthStatus.NoPasswordHash
          : AuthStatus.WrongPassword;

      await this.authLogService
        .recordSignInLog({
          email: signInDto.email,
          userId: user?.id,
          status,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'signIn'),
        );

      throw new UnauthorizedException('Credenciais inválidas.');
    }

    try {
      const { refreshToken } = await this.prismaService.$transaction(
        async (tx) => {
          const { token: refreshToken } = await this.refreshTokenService.issue(
            user.id,
            session,
            tx,
          );
          await this.authLogService.recordSignInLog(
            {
              email: user.email,
              userId: user.id,
              status: AuthStatus.Success,
              ipAddress: session.ip,
              userAgent: session.userAgent,
              occurredAt: now,
            },
            tx,
          );
          return { refreshToken };
        },
      );

      const accessToken = await this.tokenService.signAccess(user.id);

      return {
        refreshToken,
        accessToken,
        user: PublicUserSchema.parse(user),
      };
    } catch (error) {
      this.logger.error({ error, email: signInDto.email }, 'signIn');

      await this.authLogService
        .recordSignInLog({
          email: signInDto.email,
          status: AuthStatus.Failed,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'signIn'),
        );

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException('Não foi possível autenticar.');
    }
  }
}
