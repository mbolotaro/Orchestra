export interface ResetPasswordTokenPayload {
  userId: string;
  email: string;
}

export interface IssuePasswordResetResponse {
  rawToken: string;
}
