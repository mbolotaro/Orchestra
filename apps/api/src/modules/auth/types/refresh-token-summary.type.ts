export interface RefreshTokenSummary {
  id: string;
  jti: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}
