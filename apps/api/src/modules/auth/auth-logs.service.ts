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
}
