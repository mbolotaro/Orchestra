import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { EnvService } from '../env/env.service';
import { PrismaClient } from '../../generated/prisma/client.js';

function buildConnectionString(env: EnvService): string {
  const user = env.get('DB_USER');
  const password = env.get('DB_PASSWORD');
  const name = env.get('DB_NAME');
  const port = env.get('DB_PORT');
  const host = env.get('DB_HOST') ?? 'localhost';

  return `postgres://${user}:${password}@${host}:${port}/${name}`;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(env: EnvService) {
    super({
      adapter: new PrismaPg({
        connectionString: buildConnectionString(env),
      }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
