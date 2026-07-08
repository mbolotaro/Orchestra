import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EnvService } from '../../../env/env.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { VerifyEmailTokenService } from '../verify-email-token.service';
import { InvalidVerifyTokenException } from '../exceptions/invalid-verify-token.exception';
import { RateLimitedException } from '../../../../common/exceptions/rate-limited.exception';
import { VERIFY_EMAIL_COOLDOWN_MS } from '../../auth.constants';

const USER_ID = '0193b3c0-0000-7000-8000-000000000000';
const EMAIL = 'mario@test.com';
const PEPPER = 'test-pepper-fixed-32-chars-1234567890abcd';

describe('VerifyEmailTokenService', () => {
  let service: VerifyEmailTokenService;
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
        VerifyEmailTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    service = module.get(VerifyEmailTokenService);
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
      prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
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

    it('happy path: queries for recent unused tokens with createdAt cooldown window', async () => {
      prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
      prisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.emailVerificationToken.create.mockResolvedValue({} as never);

      await service.issue(USER_ID, EMAIL);

      expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith({
        where: {
          userId: USER_ID,
          usedAt: null,
          createdAt: { gte: expect.any(Date) },
        },
      });
    });

    it('happy path: rawToken is unique on each call', async () => {
      prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
      prisma.emailVerificationToken.updateMany.mockResolvedValue({ count: 0 });
      prisma.emailVerificationToken.create.mockResolvedValue({} as never);

      const { rawToken: a } = await service.issue(USER_ID, EMAIL);
      const { rawToken: b } = await service.issue(USER_ID, EMAIL);

      expect(a).not.toBe(b);
    });

    it('error: throws RateLimitedException when a recent unused token exists', async () => {
      prisma.emailVerificationToken.findFirst.mockResolvedValue({
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
      expect(prisma.emailVerificationToken.create).not.toHaveBeenCalled();
      expect(prisma.emailVerificationToken.updateMany).not.toHaveBeenCalled();
    });

    it('error: RateLimitedException carries retryAfterSeconds in details', async () => {
      const elapsedMs = 20_000;
      prisma.emailVerificationToken.findFirst.mockResolvedValue({
        id: 'recent-1',
        userId: USER_ID,
        email: EMAIL,
        tokenHash: 'hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: new Date(Date.now() - elapsedMs),
      });

      try {
        await service.issue(USER_ID, EMAIL);
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(RateLimitedException);
        const e = err as RateLimitedException;
        const retry = e.details?.retryAfterSeconds as number;
        const expected = Math.ceil(
          (VERIFY_EMAIL_COOLDOWN_MS - elapsedMs) / 1000,
        );
        expect(retry).toBeGreaterThan(0);
        expect(Math.abs(retry - expected)).toBeLessThanOrEqual(1);
      }
    });

    it('error: throws InternalServerErrorException when DB fails', async () => {
      prisma.emailVerificationToken.findFirst.mockResolvedValue(null);
      prisma.$transaction.mockRejectedValue(new Error('db down'));

      await expect(service.issue(USER_ID, EMAIL)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('edge case: rethrows RateLimitedException without wrapping it (HttpException passthrough)', async () => {
      prisma.emailVerificationToken.findFirst.mockResolvedValue({
        id: 'recent-1',
        userId: USER_ID,
        email: EMAIL,
        tokenHash: 'hash',
        usedAt: null,
        expiresAt: new Date(Date.now() + 3_600_000),
        createdAt: new Date(Date.now() - 10_000),
      });

      await expect(service.issue(USER_ID, EMAIL)).rejects.not.toThrow(
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
