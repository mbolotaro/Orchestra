import { Job } from 'bullmq';

export enum AuthEmailJobType {
  VerifyEmail = 'verify_email',
  ResetPassword = 'reset_password',
}

export interface VerifyEmailJobPayload {
  to: string;
  userName: string;
  token: string;
}

export interface ResetPasswordJobPayload {
  to: string;
  userName: string;
  token: string;
}

export type AuthEmailJob =
  | Job<VerifyEmailJobPayload, unknown, AuthEmailJobType.VerifyEmail>
  | Job<ResetPasswordJobPayload, unknown, AuthEmailJobType.ResetPassword>;
