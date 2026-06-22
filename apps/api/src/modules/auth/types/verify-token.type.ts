export interface VerifyEmailTokenPayload {
  userId: string;
  email: string;
}

export interface IssueVerifyEmailResponse {
  rawToken: string;
}
