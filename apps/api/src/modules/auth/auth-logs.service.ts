import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordAuthLog } from './types/record-auth-log.type';
import { AuthAction, AuthLog } from '../../generated/prisma/client';
import { TransactionClient } from '../../generated/prisma/internal/prismaNamespace';

@Injectable()
export class AuthLogsService {
  private readonly logger = new Logger(AuthLogsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async recordSignUpLog(
    recordAuthLog: RecordAuthLog,
    tx?: TransactionClient,
  ): Promise<AuthLog> {
    try {
      const client = tx ?? this.prismaService;

      const log = await client.authLog.create({
        data: {
          action: AuthAction.SignUp,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });

      return log;
    } catch (error) {
      this.logger.error({ error }, 'recordSignUpLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar autenticação.',
      );
    }
  }

  async recordSignInLog(recordAuthLog: RecordAuthLog, tx?: TransactionClient) {
    try {
      const client = tx ?? this.prismaService;

      const log = await client.authLog.create({
        data: {
          action: AuthAction.SignIn,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });

      return log;
    } catch (error) {
      this.logger.error({ error }, 'recordSignInLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar autenticação.',
      );
    }
  }

  async recordRefreshLog(recordAuthLog: RecordAuthLog, tx?: TransactionClient) {
    try {
      const client = tx ?? this.prismaService;

      const log = await client.authLog.create({
        data: {
          action: AuthAction.Refresh,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });

      return log;
    } catch (error) {
      this.logger.error({ error }, 'recordRefreshLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar atualização de sessão.',
      );
    }
  }

  async recordSignOutLog(recordAuthLog: RecordAuthLog, tx?: TransactionClient) {
    try {
      const client = tx ?? this.prismaService;
      return client.authLog.create({
        data: {
          action: AuthAction.SignOut,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'recordRefreshLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar atualização de sessão.',
      );
    }
  }

  async recordVerifyEmailLog(
    recordAuthLog: RecordAuthLog,
    tx?: TransactionClient,
  ) {
    try {
      const client = tx ?? this.prismaService;
      return await client.authLog.create({
        data: {
          action: AuthAction.VerifyEmail,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'recordVerifyEmailLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar verificação de email.',
      );
    }
  }

  async recordPasswordResetLog(
    recordAuthLog: RecordAuthLog,
    tx?: TransactionClient,
  ) {
    try {
      const client = tx ?? this.prismaService;
      return await client.authLog.create({
        data: {
          action: AuthAction.PasswordReset,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'recordPasswordResetLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar redefinição de senha.',
      );
    }
  }

  async recordForgotPasswordLog(
    recordAuthLog: RecordAuthLog,
    tx?: TransactionClient,
  ) {
    try {
      const client = tx ?? this.prismaService;
      return await client.authLog.create({
        data: {
          action: AuthAction.ForgotPassword,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'recordForgotPasswordLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar solicitação de redefinição.',
      );
    }
  }

  async recordResendVerifyEmailLog(
    recordAuthLog: RecordAuthLog,
    tx?: TransactionClient,
  ) {
    try {
      const client = tx ?? this.prismaService;
      return await client.authLog.create({
        data: {
          action: AuthAction.ResendVerifyEmail,
          status: recordAuthLog.status,
          email: recordAuthLog.email,
          userId: recordAuthLog.userId,
          occurredAt: recordAuthLog.occurredAt,
          ipAddress: recordAuthLog.ipAddress,
          userAgent: recordAuthLog.userAgent,
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'recordResendVerifyEmailLog');

      throw new InternalServerErrorException(
        'Não foi possível registrar reenvio de verificação.',
      );
    }
  }
}
