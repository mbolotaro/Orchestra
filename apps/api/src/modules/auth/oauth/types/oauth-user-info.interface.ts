export interface OAuthUserInfo {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
}
