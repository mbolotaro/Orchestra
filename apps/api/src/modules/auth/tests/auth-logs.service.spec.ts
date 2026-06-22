import { InternalServerErrorException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { AuthAction, AuthStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthLogsService } from '../auth-logs.service';
import type { RecordAuthLog } from '../types/record-auth-log.type';

describe('AuthLogsService', () => {
  let service: AuthLogsService;
  let prisma: DeepMockProxy<PrismaService>;

  const baseRecord: RecordAuthLog = {
    email: 'mario@test.com',
    userId: 'user-123',
    status: AuthStatus.Success,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
    occurredAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthLogsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AuthLogsService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('recordSignUpLog', () => {
    it('happy path: persists AuthLog with action SignUp using global client', async () => {
      const createdLog = { id: 'log-1' };
      prisma.authLog.create.mockResolvedValue(createdLog as never);

      const result = await service.recordSignUpLog(baseRecord);

      expect(result).toEqual(createdLog);
      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: AuthAction.SignUp,
          status: baseRecord.status,
          email: baseRecord.email,
          userId: baseRecord.userId,
          occurredAt: baseRecord.occurredAt,
          ipAddress: baseRecord.ipAddress,
          userAgent: baseRecord.userAgent,
        }),
      });
    });

    it('happy path: uses provided transaction client when tx is passed', async () => {
      const tx = mockDeep<PrismaService>();
      tx.authLog.create.mockResolvedValue({ id: 'log-tx' } as never);

      await service.recordSignUpLog(baseRecord, tx);

      expect(tx.authLog.create).toHaveBeenCalled();
      expect(prisma.authLog.create).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when prisma.create fails', async () => {
      prisma.authLog.create.mockRejectedValue(new Error('db down'));

      await expect(service.recordSignUpLog(baseRecord)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('recordSignInLog', () => {
    it('happy path: persists AuthLog with action SignIn', async () => {
      prisma.authLog.create.mockResolvedValue({ id: 'log-2' } as never);

      await service.recordSignInLog(baseRecord);

      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: AuthAction.SignIn }),
      });
    });

    it('happy path: uses tx client when provided', async () => {
      const tx = mockDeep<PrismaService>();
      tx.authLog.create.mockResolvedValue({ id: 'log-tx' } as never);

      await service.recordSignInLog(baseRecord, tx);

      expect(tx.authLog.create).toHaveBeenCalled();
      expect(prisma.authLog.create).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when prisma.create fails', async () => {
      prisma.authLog.create.mockRejectedValue(new Error('db down'));

      await expect(service.recordSignInLog(baseRecord)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('recordRefreshLog', () => {
    it('happy path: persists AuthLog with action Refresh', async () => {
      prisma.authLog.create.mockResolvedValue({ id: 'log-3' } as never);

      await service.recordRefreshLog(baseRecord);

      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: AuthAction.Refresh }),
      });
    });

    it('error: throws InternalServerErrorException when prisma.create fails', async () => {
      prisma.authLog.create.mockRejectedValue(new Error('db down'));

      await expect(service.recordRefreshLog(baseRecord)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('recordSignOutLog', () => {
    it('happy path: persists AuthLog with action SignOut', async () => {
      prisma.authLog.create.mockResolvedValue({ id: 'log-4' } as never);

      await service.recordSignOutLog(baseRecord);

      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: AuthAction.SignOut }),
      });
    });

    it('happy path: uses tx client when provided', async () => {
      const tx = mockDeep<PrismaService>();
      tx.authLog.create.mockResolvedValue({ id: 'log-tx' } as never);

      await service.recordSignOutLog(baseRecord, tx);

      expect(tx.authLog.create).toHaveBeenCalled();
      expect(prisma.authLog.create).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when prisma.create fails', async () => {
      prisma.authLog.create.mockRejectedValue(new Error('db down'));

      await expect(service.recordRefreshLog(baseRecord)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('recordVerifyEmailLog', () => {
    it('happy path: persists AuthLog with action VerifyEmail', async () => {
      prisma.authLog.create.mockResolvedValue({ id: 'log-5' } as never);

      await service.recordVerifyEmailLog(baseRecord);

      expect(prisma.authLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: AuthAction.VerifyEmail }),
      });
    });

    it('happy path: uses tx client when provided', async () => {
      const tx = mockDeep<PrismaService>();
      tx.authLog.create.mockResolvedValue({ id: 'log-tx' } as never);

      await service.recordVerifyEmailLog(baseRecord, tx);

      expect(tx.authLog.create).toHaveBeenCalled();
      expect(prisma.authLog.create).not.toHaveBeenCalled();
    });

    it('error: throws InternalServerErrorException when prisma.create fails', async () => {
      prisma.authLog.create.mockRejectedValue(new Error('db down'));

      await expect(service.recordVerifyEmailLog(baseRecord)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
