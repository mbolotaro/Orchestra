import { PublicUser } from '@orchestra/schemas';

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}
