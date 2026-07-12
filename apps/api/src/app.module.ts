import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';
import { AppController } from './app.controller';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { EnvModule } from './modules/env/env.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { EmailModule } from './modules/email/email.module';
import { BullModule } from '@nestjs/bullmq';
import { EnvService } from './modules/env/env.service';
import { RedisService } from './modules/redis/redis.service';
import { RedisModule } from './modules/redis/redis.module';
import { RateLimitModule } from './modules/rate-limit/rate-limit.module';
import { RateLimitGuard } from './modules/rate-limit/guards/rate-limit.guard';

@Module({
  imports: [
    EnvModule,
    BullModule.forRootAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        connection: {
          host: env.get('REDIS_HOST'),
          port: parseInt(env.get('REDIS_PORT')),
          password: env.get('REDIS_PASSWORD'),
        },
      }),
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    EmailModule,
    RedisModule,
    RateLimitModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ZodSerializerInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    RedisService,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
