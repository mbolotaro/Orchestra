import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { AuthLogsService } from './auth-logs.service';
import { TokenService } from './token.service';
import { JwtModule } from '@nestjs/jwt';
import { EnvModule } from '../env/env.module';
import { EnvService } from '../env/env.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuthCookieService } from './auth-cookie.service';
import { AuthGuard } from './guards/auth.guard';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { EmailModule } from '../email/email.module';
import { BullModule } from '@nestjs/bullmq';
import { AUTH_EMAIL_QUEUE } from './auth.constants';
import { AuthProcessor } from './auth-email.processor';
import { PasswordResetTokenService } from './password-reset-token.service';

@Module({
  imports: [
    UsersModule,
    EmailModule,
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
    JwtModule.registerAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        secret: env.get('JWT_SECRET'),
        signOptions: { expiresIn: env.get('JWT_ACCESS_EXPIRATION') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthLogsService,
    TokenService,
    RefreshTokenService,
    AuthCookieService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    EmailVerificationTokenService,
    AuthProcessor,
    PasswordResetTokenService,
  ],
})
export class AuthModule {}
