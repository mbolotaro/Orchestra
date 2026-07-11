import { OAuthTokenResponse } from './oauth-token-response.interface';
import { OAuthUserInfo } from './oauth-user-info.interface';

export interface OAuthProviderClient {
  getAuthorizeUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<OAuthTokenResponse>;
  getUserInfo(accessToken: string): Promise<OAuthUserInfo>;
}
