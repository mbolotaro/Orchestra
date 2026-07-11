import { PublicUser } from '@orchestra/schemas';

export interface OAuthCallbackResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  redirectTo: string;
}
