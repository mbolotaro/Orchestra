import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EnvService } from '../env/env.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(env: EnvService) {
    this.client = new Redis({
      host: env.get('REDIS_HOST'),
      port: parseInt(env.get('REDIS_PORT')),
      password: env.get('REDIS_PASSWORD'),
    });
  }

  async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
    await this.client.set(key, value, 'EX', ttlSeconds);
  }

  async getDel(key: string): Promise<string | null> {
    return await this.client.getdel(key);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
