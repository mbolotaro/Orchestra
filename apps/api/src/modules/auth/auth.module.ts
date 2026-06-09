import { Module } from '@nestjs/common';
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

@Module({
  imports: [
    UsersModule,
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
  ],
})
export class AuthModule {}
