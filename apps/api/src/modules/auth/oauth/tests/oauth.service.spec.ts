import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { OAuthProvider } from '@orchestra/schemas';
import { OAuthService } from '../oauth.service';
import { RedisService } from '../../../redis/redis.service';
import { OAuthProvidersRegistry } from '../providers/oauth-providers.registry';
import { PrismaService } from '../../../prisma/prisma.service';
import { UsersService } from '../../../users/users.service';
import { RefreshTokenService } from '../../tokens/refresh-token.service';
import { TokenService } from '../../tokens/token.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { EnvService } from '../../../env/env.service';
import { OAuthProviderClient } from '../types/oauth-provider.interface';
import {
  AuthStatus,
  OAuthAccountType,
} from '../../../../generated/prisma/enums';
import { AccessTokenScope } from '../../tokens/types/access-token.type';
import { OAuthStatePayload } from '../schemas/oauth-state-payload.schema';
import type { SessionInfoPayload } from '../../types/session-info.type';

const session: SessionInfoPayload = {
  ip: '127.0.0.1',
  userAgent: 'jest',
};

const publicUser = {
  id: '0193b3c0-0000-7000-8000-000000000000',
  firstName: 'Mario',
  lastName: 'Souza',
  email: 'mario@test.com',
  isEmailVerified: true,
};

describe('OAuthService', () => {
  let service: OAuthService;
  let redis: DeepMockProxy<RedisService>;
  let providers: DeepMockProxy<OAuthProvidersRegistry>;
  let prisma: DeepMockProxy<PrismaService>;
  let users: DeepMockProxy<UsersService>;
  let refreshTokens: DeepMockProxy<RefreshTokenService>;
  let tokens: DeepMockProxy<TokenService>;
  let auditLogs: DeepMockProxy<AuditLogService>;
  let env: DeepMockProxy<EnvService>;
  let providerClient: DeepMockProxy<OAuthProviderClient>;

  beforeEach(async () => {
    redis = mockDeep<RedisService>();
    providers = mockDeep<OAuthProvidersRegistry>();
    prisma = mockDeep<PrismaService>();
    users = mockDeep<UsersService>();
    refreshTokens = mockDeep<RefreshTokenService>();
    tokens = mockDeep<TokenService>();
    auditLogs = mockDeep<AuditLogService>();
    env = mockDeep<EnvService>();
    providerClient = mockDeep<OAuthProviderClient>();

    providers.get.mockReturnValue(providerClient);
    env.get.mockImplementation((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3040';
      return '';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthService,
        { provide: RedisService, useValue: redis },
        { provide: OAuthProvidersRegistry, useValue: providers },
        { provide: PrismaService, useValue: prisma },
        { provide: UsersService, useValue: users },
        { provide: RefreshTokenService, useValue: refreshTokens },
        { provide: TokenService, useValue: tokens },
        { provide: AuditLogService, useValue: auditLogs },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    service = module.get(OAuthService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('start', () => {
    it('happy path: generates state, stores in Redis and returns authorize URL', async () => {
      providerClient.getAuthorizeUrl.mockReturnValue(
        'https://accounts.google.com/authorize?...',
      );
      redis.setEx.mockResolvedValue(undefined);

      const url = await service.start(OAuthProvider.Google, '/dashboard');

      expect(url).toBe('https://accounts.google.com/authorize?...');
      expect(redis.setEx).toHaveBeenCalledWith(
        expect.stringMatching(/^oauth:state:[A-Za-z0-9_-]+$/),
        300,
        expect.any(String),
      );

      const [, , stateJson] = redis.setEx.mock.calls[0];
      const stored = JSON.parse(stateJson) as OAuthStatePayload;
      expect(stored.provider).toBe(OAuthProvider.Google);
      expect(stored.returnTo).toBe('/dashboard');
      expect(typeof stored.createdAt).toBe('number');
    });

    it('happy path: works without returnTo', async () => {
      providerClient.getAuthorizeUrl.mockReturnValue('https://x');
      redis.setEx.mockResolvedValue(undefined);

      const url = await service.start(OAuthProvider.Google);

      expect(url).toBe('https://x');
      const [, , stateJson] = redis.setEx.mock.calls[0];
      const stored = JSON.parse(stateJson) as OAuthStatePayload;
      expect(stored.returnTo).toBeUndefined();
    });

    it('error: throws InternalServerErrorException when Redis fails', async () => {
      redis.setEx.mockRejectedValue(new Error('redis down'));

      await expect(service.start(OAuthProvider.Google)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('callback', () => {
    const CODE = 'auth-code-xyz';
    const STATE = 'state-token-abc';

    function stateJson(overrides: Partial<OAuthStatePayload> = {}): string {
      return JSON.stringify({
        provider: OAuthProvider.Google,
        createdAt: Date.now(),
        ...overrides,
      });
    }

    function setupHappyProviderCalls() {
      providerClient.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'google.access.token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
      providerClient.getUserInfo.mockResolvedValue({
        providerAccountId: 'google-sub-xyz',
        email: publicUser.email,
        emailVerified: true,
        firstName: publicUser.firstName,
        lastName: publicUser.lastName,
      });
    }

    function setupTokenIssuance() {
      refreshTokens.issue.mockResolvedValue({
        token: 'refresh.token',
        jti: 'jti-abc',
      });
      tokens.signAccess.mockResolvedValue('access.token');
      auditLogs.recordSignInLog.mockResolvedValue({} as never);
    }

    it('happy path: existing OAuthAccount → returns linked user with fresh tokens', async () => {
      redis.getDel.mockResolvedValue(stateJson());
      setupHappyProviderCalls();
      setupTokenIssuance();

      prisma.oAuthAccount.findUnique.mockResolvedValue({
        id: 'oauth-account-1',
        provider: OAuthAccountType.Google,
        providerId: 'google-sub-xyz',
        userId: publicUser.id,
        createdAt: new Date(),
        updatedAt: null,
        user: publicUser,
      } as never);

      const result = await service.callback(
        OAuthProvider.Google,
        CODE,
        STATE,
        session,
      );

      expect(result.accessToken).toBe('access.token');
      expect(result.refreshToken).toBe('refresh.token');
      expect(result.user).toEqual(publicUser);
      expect(result.redirectTo).toBe('http://localhost:3040');
      expect(users.create).not.toHaveBeenCalled();
      expect(prisma.oAuthAccount.create).not.toHaveBeenCalled();
      expect(tokens.signAccess).toHaveBeenCalledWith(
        publicUser.id,
        AccessTokenScope.Full,
      );
    });

    it('happy path: uses returnTo from state as redirectTo', async () => {
      redis.getDel.mockResolvedValue(stateJson({ returnTo: '/dashboard' }));
      setupHappyProviderCalls();
      setupTokenIssuance();
      prisma.oAuthAccount.findUnique.mockResolvedValue({
        user: publicUser,
      } as never);

      const result = await service.callback(
        OAuthProvider.Google,
        CODE,
        STATE,
        session,
      );

      expect(result.redirectTo).toBe('/dashboard');
    });

    it('edge case: no OAuthAccount but user with matching verified email → links account', async () => {
      redis.getDel.mockResolvedValue(stateJson());
      setupHappyProviderCalls();
      setupTokenIssuance();
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(publicUser);
      prisma.oAuthAccount.create.mockResolvedValue({} as never);

      const result = await service.callback(
        OAuthProvider.Google,
        CODE,
        STATE,
        session,
      );

      expect(users.findByEmail).toHaveBeenCalledWith(publicUser.email);
      expect(prisma.oAuthAccount.create).toHaveBeenCalledWith({
        data: {
          userId: publicUser.id,
          provider: OAuthAccountType.Google,
          providerId: 'google-sub-xyz',
        },
      });
      expect(users.create).not.toHaveBeenCalled();
      expect(result.user).toEqual(publicUser);
    });

    it('edge case: does NOT auto-link if email is unverified on provider', async () => {
      redis.getDel.mockResolvedValue(stateJson());
      providerClient.exchangeCodeForToken.mockResolvedValue({
        accessToken: 'x',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
      providerClient.getUserInfo.mockResolvedValue({
        providerAccountId: 'google-sub-xyz',
        email: publicUser.email,
        emailVerified: false,
        firstName: publicUser.firstName,
        lastName: publicUser.lastName,
      });
      setupTokenIssuance();
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      users.create.mockResolvedValue(publicUser);

      await service.callback(OAuthProvider.Google, CODE, STATE, session);

      expect(users.findByEmail).not.toHaveBeenCalled();
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'oauth',
          email: publicUser.email,
        }),
      );
    });

    it('edge case: no OAuthAccount, no user with email → creates new user', async () => {
      redis.getDel.mockResolvedValue(stateJson());
      setupHappyProviderCalls();
      setupTokenIssuance();
      prisma.oAuthAccount.findUnique.mockResolvedValue(null);
      users.findByEmail.mockResolvedValue(null);
      users.create.mockResolvedValue(publicUser);

      await service.callback(OAuthProvider.Google, CODE, STATE, session);

      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: 'oauth',
          firstName: publicUser.firstName,
          lastName: publicUser.lastName,
          email: publicUser.email,
          oauthAccount: {
            provider: OAuthAccountType.Google,
            providerId: 'google-sub-xyz',
          },
        }),
      );
    });

    it('error: throws BadRequestException when state is missing/expired in Redis', async () => {
      redis.getDel.mockResolvedValue(null);
      auditLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(
        service.callback(OAuthProvider.Google, CODE, STATE, session),
      ).rejects.toThrow(BadRequestException);
      expect(providerClient.exchangeCodeForToken).not.toHaveBeenCalled();
    });

    it('error: throws BadRequestException when stored state is malformed JSON', async () => {
      redis.getDel.mockResolvedValue('not-json-at-all');
      auditLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(
        service.callback(OAuthProvider.Google, CODE, STATE, session),
      ).rejects.toThrow(BadRequestException);
    });

    it('error: throws BadRequestException when state.provider does not match callback provider', async () => {
      redis.getDel.mockResolvedValue(
        stateJson({ provider: OAuthProvider.GitHub }),
      );
      auditLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(
        service.callback(OAuthProvider.Google, CODE, STATE, session),
      ).rejects.toThrow(BadRequestException);
      expect(providerClient.exchangeCodeForToken).not.toHaveBeenCalled();
    });

    it('error: audit-logs Failed sign-in when callback fails', async () => {
      redis.getDel.mockResolvedValue(null);
      auditLogs.recordSignInLog.mockResolvedValue({} as never);

      await expect(
        service.callback(OAuthProvider.Google, CODE, STATE, session),
      ).rejects.toThrow(BadRequestException);

      expect(auditLogs.recordSignInLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: AuthStatus.Failed }),
      );
    });
  });
});
