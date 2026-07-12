import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { EnvModule } from '../env/env.module';
import { EnvService } from '../env/env.service';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        storage: new ThrottlerStorageRedisService({
          host: env.get('REDIS_HOST'),
          port: parseInt(env.get('REDIS_PORT'), 10),
          password: env.get('REDIS_PASSWORD'),
        }),
      }),
    }),
  ],
  exports: [ThrottlerModule],
})
export class RateLimitModule {}
