import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { EnvService } from '../../../env/env.service';
import { OAuthProviderClient } from '../types/oauth-provider.interface';
import { OAuthTokenResponse } from '../types/oauth-token-response.interface';
import { OAuthUserInfo } from '../types/oauth-user-info.interface';
import { GoogleTokenResponse } from '../types/google-token-response.interface';
import { GoogleUserInfoResponse } from '../types/googler-user-info-response.interface';

@Injectable()
export class GoogleProvider implements OAuthProviderClient {
  private readonly logger = new Logger(GoogleProvider.name);
  private readonly authorizeUrl =
    'https://accounts.google.com/o/oauth2/v2/auth';

  private readonly tokenUrl = 'https://oauth2.googleapis.com/token';
  private readonly userInfoUrl =
    'https://www.googleapis.com/oauth2/v3/userinfo';

  constructor(
    private readonly env: EnvService,
    private readonly http: HttpService,
  ) {}

  getAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.env.get('GOOGLE_CLIENT_ID'),
      redirect_uri: this.getCallbackUrl(),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });

    return `${this.authorizeUrl}?${params}`;
  }

  async exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
    try {
      const { data } = await firstValueFrom(
        this.http.post<GoogleTokenResponse>(
          this.tokenUrl,
          new URLSearchParams({
            code,
            client_id: this.env.get('GOOGLE_CLIENT_ID'),
            client_secret: this.env.get('GOOGLE_CLIENT_SECRET'),
            redirect_uri: this.getCallbackUrl(),
            grant_type: 'authorization_code',
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      };
    } catch (error) {
      this.logAxiosError(error, 'exchangeCodeForToken');
      throw new BadGatewayException('Não foi possível obter tokens do Google.');
    }
  }

  async getUserInfo(accessToken: string): Promise<OAuthUserInfo> {
    try {
      const { data } = await firstValueFrom(
        this.http.get<GoogleUserInfoResponse>(this.userInfoUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      const nameParts = data.name?.split(' ') ?? [];
      const firstName = data.given_name ?? nameParts[0] ?? 'User';
      const lastName = data.family_name ?? nameParts.slice(1).join(' ') ?? '';

      return {
        providerAccountId: data.sub,
        email: data.email,
        emailVerified: data.email_verified,
        firstName,
        lastName: lastName || undefined,
        avatarUrl: data.picture,
      };
    } catch (error) {
      this.logAxiosError(error, 'getUserInfo');
      throw new BadGatewayException(
        'Não foi possível obter dados do usuário no Google.',
      );
    }
  }

  private getCallbackUrl(): string {
    return `${this.env.get('OAUTH_CALLBACK_BASE')}/auth/oauth/google/callback`;
  }

  private logAxiosError(error: unknown, context: string): void {
    if (error instanceof AxiosError && error.response) {
      this.logger.error(
        {
          status: error.response.status,
          body: error.response.data as unknown,
        },
        context,
      );
      return;
    }
    this.logger.error({ error }, context);
  }
}
