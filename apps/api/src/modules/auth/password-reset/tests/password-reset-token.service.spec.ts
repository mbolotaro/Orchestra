import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EnvService } from '../../../env/env.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordResetTokenService } from '../password-reset-token.service';
import { InvalidResetPasswordTokenException } from '../exceptions/invalid-reset-password-token.exception';
import { RateLimitedException } from '../../../../common/exceptions/rate-limited.exception';
import { RESET_PASSWORD_COOLDOWN_MS } from '../../auth.constants';

const USER_ID = '0193b3c0-0000-7000-8000-000000000000';
const EMAIL = 'mario@test.com';
const PEPPER = 'test-pepper-fixed-32-chars-1234567890abcd';

describe('PasswordResetTokenService', () => {
  let service: PasswordResetTokenService;
  let prisma: DeepMockProxy<PrismaService>;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    env = mockDeep<EnvService>();

    env.get.mockImplementation((key: string) => {
      if (key === 'PASSWORD_RESET_PEPPER') return PEPPER;
      if (key === 'PASSWORD_RESET_EXPIRATION') return '1h';
      return '';
    });

    prisma.$transaction.mockImplementation(async (cb: unknown) => {
      return await (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PasswordResetTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    service = module.get(PasswordResetTokenService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('issue', () => {
    it('happy path: invalidates previous tokens AND creates a new one in transaction', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.passwordResetToken.create.mockResolvedValue({} as never);

      const { rawToken } = await service.issue(USER_ID, EMAIL);

      expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(rawToken.length).toBeGreaterThanOrEqual(40);

      expect(prisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          email: EMAIL,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('happy path: rawToken is unique on each call', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.passwordResetToken.create.mockResolvedValue({} as never);

      const { rawToken: a } = await service.issue(USER_ID, EMAIL);
      const { rawToken: b } = await service.issue(USER_ID, EMAIL);

      expect(a).not.toBe(b);
    });

    it('error: throws RateLimitedException when a recent unused token exists', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'recent-1',
        userId: USER_ID,
        email: EMAIL,
        tokenHash: 'hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: new Date(Date.now() - 20_000),
      });

      await expect(service.issue(USER_ID, EMAIL)).rejects.toThrow(
        RateLimitedException,
      );
      expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
      expect(prisma.passwordResetToken.updateMany).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when DB fails', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(new Error('db down'));

      await expect(service.issue(USER_ID, EMAIL)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('consume', () => {
    function buildRecord(
      overrides: Partial<{
        id: string;
        userId: string;
        email: string;
        usedAt: Date | null;
        expiresAt: Date;
      }> = {},
    ) {
      return {
        id: 'record-1',
        userId: USER_ID,
        email: EMAIL,
        tokenHash: 'hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        createdAt: new Date(),
        ...overrides,
      };
    }

    it('happy path: marks token as used and returns payload', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(buildRecord());
      prisma.passwordResetToken.update.mockResolvedValue({} as never);

      const result = await service.consume('any-raw-token');

      expect(result).toEqual({ userId: USER_ID, email: EMAIL });
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('error: throws InvalidResetPasswordTokenException without context when record does not exist', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      try {
        await service.consume('garbage');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidResetPasswordTokenException);
        const e = err as InvalidResetPasswordTokenException;
        expect(e.userId).toBeUndefined();
        expect(e.email).toBeUndefined();
      }
    });

    it('error: throws InvalidResetPasswordTokenException WITH context when record exists but is already used', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        buildRecord({ usedAt: new Date() }),
      );

      try {
        await service.consume('used-token');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidResetPasswordTokenException);
        const e = err as InvalidResetPasswordTokenException;
        expect(e.userId).toBe(USER_ID);
        expect(e.email).toBe(EMAIL);
      }
    });

    it('error: throws InvalidResetPasswordTokenException when record is expired', async () => {
      prisma.passwordResetToken.findUnique.mockResolvedValue(
        buildRecord({ expiresAt: new Date(Date.now() - 60_000) }),
      );

      await expect(service.consume('expired-token')).rejects.toThrow(
        InvalidResetPasswordTokenException,
      );
      expect(prisma.passwordResetToken.update).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when DB fails unexpectedly', async () => {
      prisma.passwordResetToken.findUnique.mockRejectedValue(
        new Error('db down'),
      );

      await expect(service.consume('any')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  void RESET_PASSWORD_COOLDOWN_MS;
});
