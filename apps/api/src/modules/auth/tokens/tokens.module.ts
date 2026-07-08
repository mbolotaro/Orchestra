import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EnvModule } from '../../env/env.module';
import { EnvService } from '../../env/env.service';
import { TokenService } from './token.service';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    EnvModule,
    JwtModule.registerAsync({
      imports: [EnvModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        secret: env.get('JWT_SECRET'),
        signOptions: { expiresIn: env.get('JWT_ACCESS_EXPIRATION') },
      }),
    }),
  ],
  providers: [TokenService, RefreshTokenService],
  exports: [TokenService, RefreshTokenService],
})
export class TokensModule {}
