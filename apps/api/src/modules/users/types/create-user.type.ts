import { OAuthAccountType } from '../../../generated/prisma/enums';

type CreateUserInputBase = {
  firstName: string;
  lastName: string;
  email: string;
};

export type CreateUserInput = CreateUserInputBase &
  (
    | { kind: 'password'; passwordHash: string }
    | {
        kind: 'oauth';
        oauthAccount: { provider: OAuthAccountType; providerId: string };
      }
  );
