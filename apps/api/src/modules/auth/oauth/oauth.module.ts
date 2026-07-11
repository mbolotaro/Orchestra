import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OAuthService } from './oauth.service';
import { OAuthController } from './oauth.controller';
import { OAuthProvidersRegistry } from './providers/oauth-providers.registry';
import { GoogleProvider } from './providers/google.provider';
import { UsersModule } from '../../users/users.module';
import { TokensModule } from '../tokens/tokens.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuthCookieService } from '../auth-cookie.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10_000,
      maxRedirects: 3,
    }),
    UsersModule,
    TokensModule,
    AuditLogModule,
  ],
  controllers: [OAuthController],
  providers: [
    OAuthService,
    OAuthProvidersRegistry,
    GoogleProvider,
    AuthCookieService,
  ],
})
export class OauthModule {}
