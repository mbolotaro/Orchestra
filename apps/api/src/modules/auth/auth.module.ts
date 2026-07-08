import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { TokensModule } from './tokens/tokens.module';
import { AuthCookieService } from './auth-cookie.service';
import { AuthGuard } from './guards/auth.guard';
import { VerifyEmailModule } from './verify-email/verify-email.module';
import { EmailModule } from '../email/email.module';
import { BullModule } from '@nestjs/bullmq';
import { AUTH_EMAIL_QUEUE } from './auth.constants';
import { AuthProcessor } from './auth-email.processor';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { AuthSessionsController } from './auth-sessions.controller';

@Module({
  imports: [
    UsersModule,
    EmailModule,
    TokensModule,
    AuditLogModule,
    VerifyEmailModule,
    PasswordResetModule,
    BullModule.registerQueue({
      name: AUTH_EMAIL_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5_000, // 5s, 10s, 20s
        },
        removeOnComplete: { age: 24 * 3600, count: 1000 }, // 1 day or 1000 items
        removeOnFail: { age: 7 * 24 * 3600 }, // 7 days
      },
    }),
  ],
  controllers: [AuthController, AuthSessionsController],
  providers: [
    AuthService,
    AuthCookieService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    AuthProcessor,
  ],
})
export class AuthModule {}
