import { Processor, WorkerHost } from '@nestjs/bullmq';
import { AUTH_EMAIL_QUEUE } from './auth.constants';
import { Job, UnrecoverableError } from 'bullmq';
import { renderVerifyEmail } from '@orchestra/emails';
import { EnvService } from '../env/env.service';
import {
  AuthEmailJob,
  AuthEmailJobType,
  ResetPasswordJobPayload,
  VerifyEmailJobPayload,
} from './types/auth-job.type';
import { EmailService } from '../email/email.service';

@Processor(AUTH_EMAIL_QUEUE)
export class AuthProcessor extends WorkerHost {
  constructor(
    private readonly email: EmailService,
    private readonly env: EnvService,
  ) {
    super();
  }

  async process(job: AuthEmailJob) {
    switch (job.name) {
      case AuthEmailJobType.VerifyEmail:
        return await this.verifyEmail(job);
      case AuthEmailJobType.ResetPassword:
        return this.resetPassword(job);
      default:
        throw new UnrecoverableError('Job not implemented!');
    }
  }

  async verifyEmail(job: Job<VerifyEmailJobPayload>) {
    const frontendUrl = this.env.get('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/verify-email?token=${job.data.token}`;
    const content = await renderVerifyEmail({
      userName: job.data.userName,
      verifyUrl,
    });

    await this.email.send({
      to: [job.data.to],
      content,
      subject: 'Confirme seu e-mail',
    });
  }

  resetPassword(job: Job<ResetPasswordJobPayload>) {
    console.error('Reset password not implemented, ', job);
  }
}
