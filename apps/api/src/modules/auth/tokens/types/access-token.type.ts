export enum AccessTokenScope {
  Unverified = 'unverified',
  Full = 'full',
}
export interface AccessTokenPayload {
  sub: string;
  type: 'access';
  scope: AccessTokenScope;
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}
