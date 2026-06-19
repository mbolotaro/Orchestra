export enum ErrorCode {
  Unauthorized = 'UNAUTHORIZED',
  InvalidCredentials = 'INVALID_CREDENTIALS',
  TokenExpired = 'TOKEN_EXPIRED',
  SessionInvalid = 'SESSION_INVALID',
  RefreshTokenReuse = 'REFRESH_TOKEN_REUSE',
  EmailNotVerified = 'EMAIL_NOT_VERIFIED',
  ScopeUpgradeNeeded = 'SCOPE_UPGRADE_NEEDED',

  EmailAlreadyExists = 'EMAIL_ALREADY_EXISTS',
  UserNotFound = 'USER_NOT_FOUND',

  ValidationFailed = 'VALIDATION_FAILED',

  BadRequest = 'BAD_REQUEST',
  Forbidden = 'FORBIDDEN',
  ResourceNotFound = 'RESOURCE_NOT_FOUND',
  Conflict = 'CONFLICT',
  RateLimited = 'RATE_LIMITED',
  InternalError = 'INTERNAL_ERROR',
}

export interface ErrorResponse {
  code: ErrorCode;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
  requestId: string;
}
