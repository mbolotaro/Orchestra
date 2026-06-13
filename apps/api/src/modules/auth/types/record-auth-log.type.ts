import { AuthStatus, OAuthAccountType } from '../../../generated/prisma/enums';

export interface RecordAuthLog {
  email?: string;
  status: AuthStatus;
  userId?: string;
  userAgent?: string;
  ipAddress?: string;
  occurredAt?: Date;
}

export interface RecordOAuthLog extends RecordAuthLog {
  provider?: OAuthAccountType;
}
