export interface AccessTokenPayload {
  sub: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}
