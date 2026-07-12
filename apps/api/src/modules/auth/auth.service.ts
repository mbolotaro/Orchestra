import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InvalidCredentialsException } from '../../common/exceptions/invalid-credentials.exception';
import { SignUpDto } from './dto/signup.dto';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionInfoPayload } from './types/session-info.type';
import { AuditLogService } from './audit-log/audit-log.service';
import { AuthStatus } from '../../generated/prisma/enums';
import { RefreshTokenService } from './tokens/refresh-token.service';
import { TokenService } from './tokens/token.service';
import { AuthSession } from './types/auth-session.type';
import { SignInDto } from './dto/signin.dto';
import {
  PublicAuth,
  PublicAuthSession,
  PublicAuthSessionList,
  PublicUser,
  PublicUserSchema,
} from '@orchestra/schemas';
import { parseUA } from '../../common/helpers/parse-ua.helper';
import { RefreshTokenReuseException } from './tokens/exceptions/refresh-token-reuse.exception';
import { AccessTokenScope } from './tokens/types/access-token.type';
import { VerifyEmailTokenService } from './verify-email/verify-email-token.service';
import { InvalidVerifyTokenException } from './verify-email/exceptions/invalid-verify-token.exception';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { AUTH_EMAIL_QUEUE } from './auth.constants';
import {
  AuthEmailJobType,
  ResetPasswordJobPayload,
  VerifyEmailJobPayload,
} from './types/auth-job.type';
import { PasswordResetTokenService } from './password-reset/password-reset-token.service';
import { RateLimitedException } from '../rate-limit/exceptions/rate-limited.exception';
import { InvalidResetPasswordTokenException } from './password-reset/exceptions/invalid-reset-password-token.exception';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectQueue(AUTH_EMAIL_QUEUE)
    private readonly authEmailQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly auditLogService: AuditLogService,
    private readonly tokenService: TokenService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly verifyEmailTokenService: VerifyEmailTokenService,
    private readonly passwordResetTokenService: PasswordResetTokenService,
  ) {}

  async signUp(
    signUpDto: SignUpDto,
    session: SessionInfoPayload,
  ): Promise<AuthSession> {
    const now = new Date();

    try {
      const passwordHash = await bcrypt.hash(signUpDto.password, 12);

      const { user, refreshToken, verifyTokenRaw } =
        await this.prismaService.$transaction(async (tx) => {
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

          await this.auditLogService.recordSignUpLog(
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

          const { rawToken: verifyTokenRaw } =
            await this.verifyEmailTokenService.issue(user.id, user.email, tx);

          const { token: refreshToken } = await this.refreshTokenService.issue(
            user.id,
            session,
            tx,
          );

          return {
            user,
            refreshToken,
            verifyTokenRaw,
          };
        });

      const accessToken = await this.tokenService.signAccess(
        user.id,
        AccessTokenScope.Unverified,
      );

      await this.enqueueVerifyEmail(user, verifyTokenRaw);

      return {
        accessToken,
        refreshToken,
        user,
      };
    } catch (error) {
      this.logger.error({ error, email: signUpDto.email }, 'signUp');

      await this.auditLogService
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

      await this.auditLogService
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

      throw new InvalidCredentialsException();
    }

    try {
      const { token: refreshToken } = await this.refreshTokenService.issue(
        user.id,
        session,
      );

      const accessTokenScope = user.isEmailVerified
        ? AccessTokenScope.Full
        : AccessTokenScope.Unverified;

      const accessToken = await this.tokenService.signAccess(
        user.id,
        accessTokenScope,
      );

      await this.auditLogService
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
        user: PublicUserSchema.parse(user satisfies PublicUser),
      };
    } catch (error) {
      this.logger.error({ error, email: signInDto.email }, 'signIn');

      await this.auditLogService
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

  async signOut(
    refreshToken: string,
    session: SessionInfoPayload,
  ): Promise<void> {
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

    await this.auditLogService
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

  async revokeSession(
    userId: string,
    sessionId: string,
    refreshToken: string | undefined,
  ): Promise<void> {
    const currentJti = refreshToken
      ? this.tokenService.decodeUnsafe(refreshToken)?.jti
      : undefined;

    await this.refreshTokenService.revokeSessionByIdForUser(
      userId,
      sessionId,
      currentJti,
    );
  }

  async revokeAllOtherSessions(
    userId: string,
    refreshToken: string | undefined,
  ): Promise<void> {
    const currentJti = refreshToken
      ? this.tokenService.decodeUnsafe(refreshToken)?.jti
      : null;

    if (!currentJti) {
      throw new UnauthorizedException('Sessão atual não identificada.');
    }

    await this.refreshTokenService.revokeAllForUserExcept(userId, currentJti);
  }

  async listSessions(
    userId: string,
    refreshToken?: string,
  ): Promise<PublicAuthSessionList> {
    const currentJti = refreshToken
      ? this.tokenService.decodeUnsafe(refreshToken)?.jti
      : null;

    const rows = await this.refreshTokenService.findActiveByUser(userId);

    const sessions = rows.map<PublicAuthSession>((row) => {
      const { browser, os, type } = parseUA(row.userAgent);

      return {
        id: row.id,
        isCurrent: row.jti === currentJti,
        lastActivityAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        ipAddress: row.ipAddress,
        device: {
          browser,
          os,
          type,
        },
      };
    });

    return { sessions };
  }

  async refresh(
    token: string,
    session: SessionInfoPayload,
  ): Promise<AuthSession> {
    const now = new Date();

    try {
      const { userId, token: refreshToken } =
        await this.refreshTokenService.rotate(token, session);

      const user = await this.usersService.getById(userId);

      const accessTokenScope = user.isEmailVerified
        ? AccessTokenScope.Full
        : AccessTokenScope.Unverified;

      const accessToken = await this.tokenService.signAccess(
        userId,
        accessTokenScope,
      );

      await this.auditLogService
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

      await this.auditLogService
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

  async verifyEmail(
    rawToken: string,
    session: SessionInfoPayload,
  ): Promise<void> {
    const now = new Date();

    try {
      const { email, userId } =
        await this.verifyEmailTokenService.consume(rawToken);

      await this.usersService.markEmailAsVerified(userId, email);
      await this.auditLogService.recordVerifyEmailLog({
        status: AuthStatus.Success,
        email,
        userId,
        ipAddress: session.ip,
        userAgent: session.userAgent,
        occurredAt: now,
      });
    } catch (error) {
      this.logger.error({ error }, 'verifyEmail');

      if (error instanceof InvalidVerifyTokenException) {
        await this.auditLogService
          .recordVerifyEmailLog({
            status: AuthStatus.InvalidVerifyToken,
            ipAddress: session.ip,
            userAgent: session.userAgent,
            email: error.email,
            userId: error.userId,
            occurredAt: now,
          })
          .catch((error: unknown) =>
            this.logger.error({ error }, 'verifyEmail'),
          );
      }

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível verificar email.',
      );
    }
  }

  async resendVerifyEmail(
    userId: string,
    session: SessionInfoPayload,
  ): Promise<void> {
    const now = new Date();

    try {
      const user = await this.usersService.getById(userId);

      if (user.isEmailVerified)
        throw new ConflictException('A sua conta já está verificada.');

      const { rawToken } = await this.verifyEmailTokenService.issue(
        user.id,
        user.email,
      );

      await this.enqueueVerifyEmail(user, rawToken);

      await this.auditLogService
        .recordResendVerifyEmailLog({
          userId: user.id,
          email: user.email,
          status: AuthStatus.Success,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'resendVerify'),
        );
    } catch (error) {
      this.logger.error({ error }, 'resendVerify');

      await this.auditLogService
        .recordResendVerifyEmailLog({
          userId,
          status: AuthStatus.Failed,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'resendVerify'),
        );

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível reenviar email de verificação.',
      );
    }
  }

  async forgotPassword(
    email: string,
    session: SessionInfoPayload,
  ): Promise<void> {
    const now = new Date();

    try {
      const user = await this.usersService.findByEmail(email);

      if (!user) {
        await this.auditLogService
          .recordForgotPasswordLog({
            email,
            status: AuthStatus.UserNotFound,
            ipAddress: session.ip,
            userAgent: session.userAgent,
            occurredAt: now,
          })
          .catch((logError: unknown) =>
            this.logger.error({ error: logError }, 'forgotPassword'),
          );
        return;
      }

      const { rawToken } = await this.passwordResetTokenService.issue(
        user.id,
        user.email,
      );

      await this.auditLogService
        .recordForgotPasswordLog({
          userId: user.id,
          email: user.email,
          status: AuthStatus.Success,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'forgotPassword'),
        );

      const resetPasswordBody: ResetPasswordJobPayload = {
        to: user.email,
        token: rawToken,
        userName: user.firstName,
      };

      await this.authEmailQueue
        .add(AuthEmailJobType.ResetPassword, resetPasswordBody)
        .catch((error: unknown) =>
          this.logger.error({ error }, 'forgotPassword:resetPasswordJob'),
        );
    } catch (error) {
      if (error instanceof RateLimitedException) {
        this.logger.warn(
          { error, email },
          'forgotPassword: cooldown hit, silenced for anti-enumeration',
        );

        await this.auditLogService
          .recordForgotPasswordLog({
            email,
            status: AuthStatus.Failed,
            ipAddress: session.ip,
            userAgent: session.userAgent,
            occurredAt: now,
          })
          .catch((logError: unknown) =>
            this.logger.error({ error: logError }, 'forgotPassword'),
          );
        return;
      }

      this.logger.error(
        { error, email },
        'forgotPassword: silent error (anti-enumeration)',
      );

      await this.auditLogService
        .recordForgotPasswordLog({
          email,
          status: AuthStatus.Failed,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'forgotPassword'),
        );
    }
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
    sessionInfo: SessionInfoPayload,
  ): Promise<void> {
    const now = new Date();

    try {
      const { email, userId } =
        await this.passwordResetTokenService.consume(rawToken);

      const newPasswordHash = await bcrypt.hash(newPassword, 12);

      await this.prismaService.$transaction(async (tx) => {
        await this.usersService.changePassword(
          userId,
          email,
          newPasswordHash,
          tx,
        );
        await this.refreshTokenService.revokeAllForUser(userId, tx);
        await this.auditLogService.recordPasswordResetLog(
          {
            email,
            userId,
            status: AuthStatus.Success,
            ipAddress: sessionInfo.ip,
            userAgent: sessionInfo.userAgent,
            occurredAt: now,
          },
          tx,
        );
      });
    } catch (error) {
      this.logger.error({ error }, 'resetPassword');

      if (error instanceof InvalidResetPasswordTokenException) {
        await this.auditLogService
          .recordPasswordResetLog({
            status: AuthStatus.InvalidResetPasswordToken,
            email: error.email,
            userId: error.userId,
            ipAddress: sessionInfo.ip,
            userAgent: sessionInfo.userAgent,
            occurredAt: now,
          })
          .catch((logError: unknown) =>
            this.logger.error({ error: logError }, 'resetPassword'),
          );
      }

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException('Não foi possível alterar senha.');
    }
  }

  private async enqueueVerifyEmail(
    user: PublicUser,
    rawToken: string,
  ): Promise<void> {
    const payload: VerifyEmailJobPayload = {
      to: user.email,
      token: rawToken,
      userName: user.firstName,
    };

    await this.authEmailQueue
      .add(AuthEmailJobType.VerifyEmail, payload)
      .catch((error: unknown) =>
        this.logger.error({ error }, 'enqueueVerifyEmail'),
      );
  }
}
