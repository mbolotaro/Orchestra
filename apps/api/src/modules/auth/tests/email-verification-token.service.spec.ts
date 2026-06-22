import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EnvService } from '../../env/env.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailVerificationTokenService } from '../email-verification-token.service';
import { InvalidVerifyTokenException } from '../exceptions/invalid-verify-token.exception';

const USER_ID = '0193b3c0-0000-7000-8000-000000000000';
const EMAIL = 'mario@test.com';
const PEPPER = 'test-pepper-fixed-32-chars-1234567890abcd';

describe('EmailVerificationTokenService', () => {
  let service: EmailVerificationTokenService;
  let prisma: DeepMockProxy<PrismaService>;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    env = mockDeep<EnvService>();

    env.get.mockImplementation((key: string) => {
      if (key === 'EMAIL_VERIFICATION_PEPPER') return PEPPER;
      if (key === 'EMAIL_VERIFICATION_EXPIRATION') return '24h';
      return '';
    });

    prisma.$transaction.mockImplementation(async (cb: unknown) => {
      return await (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailVerificationTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    service = module.get(EmailVerificationTokenService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('hash', () => {
    it('happy path: produces deterministic sha256(token + pepper)', () => {
      const hash1 = service.hash('same-token');
      const hash2 = service.hash('same-token');

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('happy path: different tokens produce different hashes', () => {
      expect(service.hash('token-a')).not.toBe(service.hash('token-b'));
    });
  });

  describe('issue', () => {
    it('happy path: invalidates previous tokens AND creates a new one in transaction', async () => {
      prisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 2 });
      prisma.emailVerificationToken.create.mockResolvedValue({} as never);

      const { rawToken } = await service.issue(USER_ID, EMAIL);

      expect(rawToken).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(rawToken.length).toBeGreaterThanOrEqual(40);

      expect(prisma.emailVerificationToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER_ID, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          email: EMAIL,
          tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('happy path: rawToken is unique on each call', async () => {
      prisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.emailVerificationToken.create.mockResolvedValue({} as never);

      const { rawToken: a } = await service.issue(USER_ID, EMAIL);
      const { rawToken: b } = await service.issue(USER_ID, EMAIL);

      expect(a).not.toBe(b);
    });

    it('error: throws InternalServerErrorException when DB fails', async () => {
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
      prisma.emailVerificationToken.findUnique.mockResolvedValue(buildRecord());
      prisma.emailVerificationToken.update.mockResolvedValue({} as never);

      const result = await service.consume('any-raw-token');

      expect(result).toEqual({ userId: USER_ID, email: EMAIL });
      expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 'record-1' },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('error: throws InvalidVerifyTokenException without context when record does not exist', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      try {
        await service.consume('garbage');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidVerifyTokenException);
        const e = err as InvalidVerifyTokenException;
        expect(e.userId).toBeUndefined();
        expect(e.email).toBeUndefined();
      }
    });

    it('error: throws InvalidVerifyTokenException WITH context when record exists but is already used', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(
        buildRecord({ usedAt: new Date() }),
      );

      try {
        await service.consume('used-token');
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidVerifyTokenException);
        const e = err as InvalidVerifyTokenException;
        expect(e.userId).toBe(USER_ID);
        expect(e.email).toBe(EMAIL);
      }
    });

    it('error: throws InvalidVerifyTokenException when record is expired', async () => {
      prisma.emailVerificationToken.findUnique.mockResolvedValue(
        buildRecord({ expiresAt: new Date(Date.now() - 60_000) }),
      );

      await expect(service.consume('expired-token')).rejects.toThrow(
        InvalidVerifyTokenException,
      );
      expect(prisma.emailVerificationToken.update).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when DB fails unexpectedly', async () => {
      prisma.emailVerificationToken.findUnique.mockRejectedValue(
        new Error('db down'),
      );

      await expect(service.consume('any')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
