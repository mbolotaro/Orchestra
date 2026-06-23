import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EnvService } from '../../env/env.service';
import { EmailService } from '../email.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    env = mockDeep<EnvService>();
    env.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_API_KEY') return 're_test_key';
      if (key === 'EMAIL') return 'onboarding@resend.dev';
      return '';
    });

    sendMock.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService, { provide: EnvService, useValue: env }],
    }).compile();

    service = module.get(EmailService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('send', () => {
    it('happy path: forwards payload to Resend and returns data', async () => {
      sendMock.mockResolvedValue({ data: { id: 'msg-123' }, error: null });

      const result = await service.send({
        to: ['mario@test.com'],
        subject: 'Hello',
        content: '<p>oi</p>',
      });

      expect(result).toEqual({ id: 'msg-123' });
      expect(sendMock).toHaveBeenCalledWith({
        from: 'onboarding@resend.dev',
        to: ['mario@test.com'],
        subject: 'Hello',
        html: '<p>oi</p>',
      });
    });

    it('error: throws when Resend returns error object', async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { name: 'validation_error', message: 'invalid email' },
      });

      await expect(
        service.send({
          to: ['broken'],
          subject: 'x',
          content: 'y',
        }),
      ).rejects.toThrow(/Resend API Error/);
    });

    it('error: rethrows when Resend SDK throws (network failure, etc.)', async () => {
      sendMock.mockRejectedValue(new Error('network down'));

      await expect(
        service.send({
          to: ['mario@test.com'],
          subject: 'x',
          content: 'y',
        }),
      ).rejects.toThrow('network down');
    });
  });
});
