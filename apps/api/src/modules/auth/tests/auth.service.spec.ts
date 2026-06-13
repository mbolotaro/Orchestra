import {
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { AuthStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { AuthLogsService } from '../auth-logs.service';
import { AuthService } from '../auth.service';
import { RefreshTokenReuseException } from '../exceptions/refresh-token-reuse.exception';
import { RefreshTokenService } from '../refresh-token.service';
import { TokenService } from '../token.service';
import type { SessionInfoPayload } from '../types/session-info.type';

jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

const session: SessionInfoPayload = {
  ip: '127.0.0.1',
  userAgent: 'jest',
};

const publicUser = {
  id: '0193b3c0-0000-7000-8000-000000000000',
  firstName: 'Mario',
  lastName: 'Souza',
  email: 'mario@test.com',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let users: DeepMockProxy<UsersService>;
  let authLogs: DeepMockProxy<AuthLogsService>;
  let tokens: DeepMockProxy<TokenService>;
  let refreshTokens: DeepMockProxy<RefreshTokenService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    users = mockDeep<UsersService>();
    authLogs = mockDeep<AuthLogsService>();
    tokens = mockDeep<TokenService>();
    refreshTokens = mockDeep<RefreshTokenService>();

    bcryptMock.hash.mockReset();
    bcryptMock.compare.mockReset();

    prisma.$transaction.mockImplementation(async (cb: unknown) => {
      return await (cb as (tx: typeof prisma) => Promise<unknown>)(prisma);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: AuthLogsService, useValue: authLogs },
        { provide: TokenService, useValue: tokens },
        { provide: RefreshTokenService, useValue: refreshTokens },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    const signUpDto = {
      firstName: 'Mario',
      lastName: 'Souza',
      email: 'mario@test.com',
      password: 'plain-password-1234',
    };

    function setupHappyPath() {
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      users.create.mockResolvedValue(publicUser);
      authLogs.recordSignUpLog.mockResolvedValue({} as never);
      refreshTokens.issue.mockResolvedValue({
        token: 'refresh.token',
        jti: 'jti-abc',
      });
      tokens.signAccess.mockResolvedValue('access.token');
    }

    it('happy path: creates user, records audit log, issues tokens and returns AuthSession', async () => {
      setupHappyPath();

      const result = await service.signUp(signUpDto, session);

      expect(result).toEqual({
        user: publicUser,
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
      });
      expect(bcryptMock.hash).toHaveBeenCalledWith('plain-password-1234', 12);
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'password',
          firstName: 'Mario',
          email: 'mario@test.com',
          passwordHash: 'hashed-password',
        }),
        prisma,
      );
      expect(authLogs.recordSignUpLog).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'mario@test.com',
          userId: publicUser.id,
          status: AuthStatus.Success,
        }),
        prisma,
      );
      expect(refreshTokens.issue).toHaveBeenCalledWith(
        publicUser.id,
        session,
        prisma,
      );
      expect(tokens.signAccess).toHaveBeenCalledWith(publicUser.id);
    });

    it('error: rethrows ConflictException from usersService.create', async () => {
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      users.create.mockRejectedValue(
        new ConflictException('Já existe um usuário'),
      );
      authLogs.recordSignUpLog.mockResolvedValue({} as never);

      await expect(service.signUp(signUpDto, session)).rejects.toThrow(
        ConflictException,
      );
    });

    it('error: logs Failed audit and throws InternalServerErrorException on unexpected error', async () => {
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      users.create.mockRejectedValue(new Error('db down'));
      authLogs.recordSignUpLog.mockResolvedValue({} as never);

      await expect(service.signUp(signUpDto, session)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(authLogs.recordSignUpLog).toHaveBeenCalledWith(
        expect.objectContaining({
          email: signUpDto.email,
          status: AuthStatus.Failed,
        }),
      );
    });

    it('edge case: still throws even if failure audit log itself fails', async () => {
      bcryptMock.hash.mockResolvedValue('hashed-password' as never);
      users.create.mockRejectedValue(new Error('db down'));
      authLogs.recordSignUpLog.mockRejectedValue(new Error('log down'));

      await expect(service.signUp(signUpDto, session)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('signIn', () => {
    const signInDto = {
      email: 'mario@test.com',
      password: 'plain-password-1234',
    };

    const rawUser = {
      ...publicUser,
      passwordHash: '$2b$12$valid-hash',
    };

    it('happy path: validates credentials, issues tokens and logs Success', async () => {
      users.findRawByEmail.mockResolvedValue(rawUser as never);
      bcryptMock.compare.mockResolvedValue(true as never);
      refreshTokens.issue.mockResolvedValue({
        token: 'refresh.token',
        jti: 'jti-abc',
      });
      tokens.signAccess.mockResolvedValue('access.token');
      authLogs.recordSignInLog.mockResolvedValue({} as never);

      const result = await service.signIn(signInDto, session);

      expect(result.accessToken).toBe('access.token');
      expect(result.refreshToken).toBe('refresh.token');
      expect(result.user).toEqual(publicUser);
      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'plain-password-1234',
        rawUser.passwordHash,
      );
      expect(authLogs.recordSignInLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: publicUser.id,
          status: AuthStatus.Success,
        }),
      );
    });

    it('error: throws UnauthorizedException and logs UserNotFound when email does not exist', async () => {
      users.findRawByEmail.mockResolvedValue(null);
      bcryptMock.compare.mockResolvedValue(false as never);
      authLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(service.signIn(signInDto, session)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authLogs.recordSignInLog).toHaveBeenCalledWith(
        expect.objectContaining({
          email: signInDto.email,
          status: AuthStatus.UserNotFound,
        }),
      );
    });

    it('error: throws UnauthorizedException and logs NoPasswordHash for oauth-only user', async () => {
      users.findRawByEmail.mockResolvedValue({
        ...rawUser,
        passwordHash: null,
      } as never);
      bcryptMock.compare.mockResolvedValue(false as never);
      authLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(service.signIn(signInDto, session)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authLogs.recordSignInLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuthStatus.NoPasswordHash }),
      );
    });

    it('error: throws UnauthorizedException and logs WrongPassword when password does not match', async () => {
      users.findRawByEmail.mockResolvedValue(rawUser as never);
      bcryptMock.compare.mockResolvedValue(false as never);
      authLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(service.signIn(signInDto, session)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authLogs.recordSignInLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuthStatus.WrongPassword }),
      );
    });

    it('edge case: always calls bcrypt.compare to keep timing constant (UserNotFound case)', async () => {
      users.findRawByEmail.mockResolvedValue(null);
      bcryptMock.compare.mockResolvedValue(false as never);
      authLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(service.signIn(signInDto, session)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcryptMock.compare).toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('happy path: returns user wrapped in PublicAuth shape', async () => {
      users.getById.mockResolvedValue(publicUser);

      const result = await service.me(publicUser.id);

      expect(result).toEqual({ user: publicUser });
      expect(users.getById).toHaveBeenCalledWith(publicUser.id);
    });
  });

  describe('refresh', () => {
    it('happy path: rotates refresh, issues access, logs Success', async () => {
      refreshTokens.rotate.mockResolvedValue({
        userId: publicUser.id,
        token: 'new.refresh.token',
        jti: 'jti-new',
      });
      users.getById.mockResolvedValue(publicUser);
      tokens.signAccess.mockResolvedValue('new.access.token');
      authLogs.recordRefreshLog.mockResolvedValue({} as never);

      const result = await service.refresh('raw-refresh', session);

      expect(result).toEqual({
        user: publicUser,
        accessToken: 'new.access.token',
        refreshToken: 'new.refresh.token',
      });
      expect(authLogs.recordRefreshLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: publicUser.id,
          status: AuthStatus.Success,
        }),
      );
    });

    it('error: rethrows RefreshTokenReuseException and logs status Reuse', async () => {
      refreshTokens.rotate.mockRejectedValue(new RefreshTokenReuseException());
      tokens.decodeUnsafe.mockReturnValue({ sub: publicUser.id });
      authLogs.recordRefreshLog.mockResolvedValue({} as never);

      await expect(service.refresh('raw-refresh', session)).rejects.toThrow(
        RefreshTokenReuseException,
      );
      expect(authLogs.recordRefreshLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: publicUser.id,
          status: AuthStatus.Reuse,
        }),
      );
    });

    it('error: rethrows UnauthorizedException with status Failed and extracted sub', async () => {
      refreshTokens.rotate.mockRejectedValue(
        new UnauthorizedException('invalid'),
      );
      tokens.decodeUnsafe.mockReturnValue({ sub: publicUser.id });
      authLogs.recordRefreshLog.mockResolvedValue({} as never);

      await expect(service.refresh('raw-refresh', session)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authLogs.recordRefreshLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: publicUser.id,
          status: AuthStatus.Failed,
        }),
      );
    });

    it('edge case: logs failure even when decodeUnsafe cannot extract sub (totally malformed token)', async () => {
      refreshTokens.rotate.mockRejectedValue(
        new UnauthorizedException('invalid'),
      );
      tokens.decodeUnsafe.mockReturnValue(null);
      authLogs.recordRefreshLog.mockResolvedValue({} as never);

      await expect(service.refresh('garbage', session)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authLogs.recordRefreshLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: undefined,
          status: AuthStatus.Failed,
        }),
      );
    });
  });
});
