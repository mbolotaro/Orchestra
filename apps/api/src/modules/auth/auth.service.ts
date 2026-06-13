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
import { AuthSession } from './types/auth-session.type';
import { SignInDto } from './dto/signin.dto';
import { PublicAuth, PublicUserSchema } from '@orchestra/schemas';
import { RefreshTokenReuseException } from './exceptions/refresh-token-reuse.exception';

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
      const { token: refreshToken } = await this.refreshTokenService.issue(
        user.id,
        session,
      );

      const accessToken = await this.tokenService.signAccess(user.id);

      await this.authLogService
        .recordSignInLog({
          email: user.email,
          userId: user.id,
          status: AuthStatus.Success,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'signIn'),
        );

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

  async signOut(refreshToken: string, session: SessionInfoPayload) {
    const now = new Date();

    const decoded = refreshToken
      ? this.tokenService.decodeUnsafe(refreshToken)
      : null;

    if (decoded?.jti) {
      await this.refreshTokenService
        .revoke(decoded.jti)
        .catch((error: unknown) => {
          this.logger.error({ error, userId: decoded.sub }, 'signOut');
        });
    }

    await this.authLogService
      .recordSignOutLog({
        userId: decoded?.sub,
        ipAddress: session.ip,
        userAgent: session.userAgent,
        occurredAt: now,
        status: AuthStatus.Success,
      })
      .catch((logError: unknown) =>
        this.logger.error({ error: logError }, 'signOut'),
      );
  }

  async me(userId: string): Promise<PublicAuth> {
    const user = await this.usersService.getById(userId);

    return {
      user,
    };
  }

  async refresh(
    token: string,
    session: SessionInfoPayload,
  ): Promise<AuthSession> {
    const now = new Date();

    try {
      const { userId, token: refreshToken } =
        await this.refreshTokenService.rotate(token, session);

      const [user, accessToken] = await Promise.all([
        this.usersService.getById(userId),
        this.tokenService.signAccess(userId),
      ]);

      await this.authLogService
        .recordRefreshLog({
          email: user.email,
          userId,
          status: AuthStatus.Success,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'refresh'),
        );

      return {
        user,
        accessToken,
        refreshToken,
      };
    } catch (error) {
      this.logger.error({ error }, 'refresh');

      const status =
        error instanceof RefreshTokenReuseException
          ? AuthStatus.Reuse
          : AuthStatus.Failed;

      const userId = this.tokenService.decodeUnsafe(token)?.sub;

      await this.authLogService
        .recordRefreshLog({
          userId,
          status,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'refresh'),
        );

      throw error;
    }
  }
}
