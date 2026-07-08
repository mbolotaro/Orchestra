import {
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EnvService } from '../../../env/env.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { RefreshTokenReuseException } from '../exceptions/refresh-token-reuse.exception';
import { RefreshTokenService } from '../refresh-token.service';
import { TokenService } from '../token.service';
import type { SessionInfoPayload } from '../../types/session-info.type';

jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

const session: SessionInfoPayload = {
  ip: '127.0.0.1',
  userAgent: 'jest',
};

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prisma: DeepMockProxy<PrismaService>;
  let tokenService: DeepMockProxy<TokenService>;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    tokenService = mockDeep<TokenService>();
    env = mockDeep<EnvService>();

    bcryptMock.hash.mockReset();
    bcryptMock.compare.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: tokenService },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    service = module.get(RefreshTokenService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('issue', () => {
    it('happy path: generates jti, signs token, persists hash and returns IssuedRefresh', async () => {
      env.get.mockReturnValue('7d');
      tokenService.signRefresh.mockResolvedValue('signed.refresh.token');
      bcryptMock.hash.mockResolvedValue('hashed-token' as never);
      prisma.refreshToken.create.mockResolvedValue({} as never);

      const result = await service.issue('user-123', session);

      expect(result.token).toBe('signed.refresh.token');
      expect(typeof result.jti).toBe('string');
      expect(result.jti.length).toBeGreaterThan(0);

      expect(tokenService.signRefresh).toHaveBeenCalledWith(
        'user-123',
        result.jti,
      );
      expect(bcryptMock.hash).toHaveBeenCalledWith('signed.refresh.token', 12);
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          jti: result.jti,
          userId: 'user-123',
          tokenHash: 'hashed-token',
          userAgent: 'jest',
          ipAddress: '127.0.0.1',
        }),
      });
    });

    it('happy path: uses tx client when provided', async () => {
      env.get.mockReturnValue('7d');
      tokenService.signRefresh.mockResolvedValue('signed.refresh.token');
      bcryptMock.hash.mockResolvedValue('hashed-token' as never);

      const tx = mockDeep<PrismaService>();
      tx.refreshToken.create.mockResolvedValue({} as never);

      await service.issue('user-123', session, tx);

      expect(tx.refreshToken.create).toHaveBeenCalled();
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when prisma.create fails', async () => {
      env.get.mockReturnValue('7d');
      tokenService.signRefresh.mockResolvedValue('signed.refresh.token');
      bcryptMock.hash.mockResolvedValue('hashed-token' as never);
      prisma.refreshToken.create.mockRejectedValue(new Error('db down'));

      await expect(service.issue('user-123', session)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('rotate', () => {
    function setupValidVerify(jti = 'jti-abc', userId = 'user-123') {
      tokenService.verifyRefresh.mockResolvedValue({
        sub: userId,
        type: 'refresh',
        jti,
      });
    }

    it('happy path: revokes old refresh, issues new one and links via replacedBy', async () => {
      setupValidVerify();
      const futureDate = new Date(Date.now() + 60_000);
      prisma.refreshToken.findUnique.mockResolvedValue({
        jti: 'jti-abc',
        userId: 'user-123',
        tokenHash: 'old-hash',
        revokedAt: null,
        expiresAt: futureDate,
      } as never);
      bcryptMock.compare.mockResolvedValue(true as never);

      prisma.$transaction.mockImplementation(async (cb: unknown) => {
        return await (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
      });

      env.get.mockReturnValue('7d');
      tokenService.signRefresh.mockResolvedValue('new.refresh.token');
      bcryptMock.hash.mockResolvedValue('new-hash' as never);
      prisma.refreshToken.create.mockResolvedValue({} as never);
      prisma.refreshToken.update.mockResolvedValue({} as never);

      const result = await service.rotate('raw-token', session);

      expect(result.userId).toBe('user-123');
      expect(result.token).toBe('new.refresh.token');
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { jti: 'jti-abc' },
        data: { revokedAt: expect.any(Date), replacedBy: result.jti },
      });
    });

    it('error: throws UnauthorizedException (via Internal) when jti is not in DB', async () => {
      setupValidVerify();
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.rotate('raw-token', session)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('error: throws RefreshTokenReuseException AND revokes all when refresh was already revoked', async () => {
      setupValidVerify('jti-abc', 'user-123');
      prisma.refreshToken.findUnique.mockResolvedValue({
        jti: 'jti-abc',
        userId: 'user-123',
        tokenHash: 'old-hash',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      } as never);
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      await expect(service.rotate('raw-token', session)).rejects.toThrow(
        RefreshTokenReuseException,
      );

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('error: throws UnauthorizedException when refresh has expired', async () => {
      setupValidVerify();
      prisma.refreshToken.findUnique.mockResolvedValue({
        jti: 'jti-abc',
        userId: 'user-123',
        tokenHash: 'old-hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      } as never);

      await expect(service.rotate('raw-token', session)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('error: throws UnauthorizedException when hash does not match', async () => {
      setupValidVerify();
      prisma.refreshToken.findUnique.mockResolvedValue({
        jti: 'jti-abc',
        userId: 'user-123',
        tokenHash: 'old-hash',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      } as never);
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(service.rotate('raw-token', session)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('error: rethrows when verifyRefresh fails (invalid signature, expired JWT)', async () => {
      tokenService.verifyRefresh.mockRejectedValue(
        new UnauthorizedException('invalid'),
      );

      await expect(service.rotate('raw-token', session)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('error: throws InternalServerErrorException when prisma fails', async () => {
      prisma.refreshToken.updateMany.mockRejectedValue(new Error('db down'));

      await expect(service.rotate('raw-token', session)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('revoke', () => {
    it('happy path: updates refresh token where jti matches and not revoked', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      await service.revoke('jti-abc');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { jti: 'jti-abc', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('edge case: no-op when jti does not match any record (count = 0)', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke('missing')).resolves.toBeUndefined();
    });

    it('error: throws InternalServerErrorException when prisma fails', async () => {
      prisma.refreshToken.updateMany.mockRejectedValue(new Error('db down'));

      await expect(service.revoke('jti-abc')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('revokeAllForUser', () => {
    it('happy path: revokes all active refresh tokens for user', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 5 });

      await service.revokeAllForUser('user-123');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('edge case: no-op when user has no active refresh tokens', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.revokeAllForUser('user-123'),
      ).resolves.toBeUndefined();
    });

    it('error: throws InternalServerErrorException when prisma fails', async () => {
      prisma.refreshToken.updateMany.mockRejectedValue(new Error('db down'));

      await expect(service.revokeAllForUser('user-123')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
