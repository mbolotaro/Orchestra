import { Injectable, Logger } from '@nestjs/common';
import { EnvService } from '../env/env.service';
import { SendEmail } from './types/send-email.type';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;

  constructor(private readonly env: EnvService) {
    this.resend = new Resend(this.env.get('EMAIL_API_KEY'));
  }

  async send(payload: SendEmail) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: this.env.get('EMAIL'),
        to: payload.to,
        html: payload.content,
        subject: payload.subject,
      });

      if (error) throw new Error(`Resend API Error: ${error.message}`);

      return data;
    } catch (error) {
      this.logger.error({ error, to: payload.to }, 'send');
      throw error;
    }
  }
}
