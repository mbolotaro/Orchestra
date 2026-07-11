import { BadGatewayException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { of, throwError } from 'rxjs';
import { AxiosError, type AxiosResponse } from 'axios';
import { GoogleProvider } from '../providers/google.provider';
import { EnvService } from '../../../env/env.service';

function axiosResponse<T>(data: T, status = 200): AxiosResponse<T> {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as never,
  };
}

describe('GoogleProvider', () => {
  let provider: GoogleProvider;
  let http: DeepMockProxy<HttpService>;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    http = mockDeep<HttpService>();
    env = mockDeep<EnvService>();

    env.get.mockImplementation((key: string) => {
      if (key === 'GOOGLE_CLIENT_ID') return 'client-id-123';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'secret-xyz';
      if (key === 'OAUTH_CALLBACK_BASE') return 'http://localhost:3000';
      return '';
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleProvider,
        { provide: HttpService, useValue: http },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    provider = module.get(GoogleProvider);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(provider).toBeDefined();
  });

  describe('getAuthorizeUrl', () => {
    it('happy path: builds URL with all required query params', () => {
      const url = provider.getAuthorizeUrl('state-token-abc');

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
      expect(url).toContain('client_id=client-id-123');
      expect(url).toContain(
        'redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Foauth%2Fgoogle%2Fcallback',
      );
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=openid+email+profile');
      expect(url).toContain('state=state-token-abc');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
    });
  });

  describe('exchangeCodeForToken', () => {
    it('happy path: POSTs to Google token endpoint and returns mapped OAuthTokenResponse', async () => {
      http.post.mockReturnValue(
        of(
          axiosResponse({
            access_token: 'google.access.token',
            refresh_token: 'google.refresh.token',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'openid email profile',
          }),
        ),
      );

      const result = await provider.exchangeCodeForToken('auth-code');

      expect(result).toEqual({
        accessToken: 'google.access.token',
        refreshToken: 'google.refresh.token',
        expiresIn: 3600,
        tokenType: 'Bearer',
        scope: 'openid email profile',
      });

      expect(http.post).toHaveBeenCalledWith(
        'https://oauth2.googleapis.com/token',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('error: throws BadGatewayException when Google responds with an AxiosError', async () => {
      const err = new AxiosError(
        'Request failed',
        'ERR_BAD_REQUEST',
        undefined,
        undefined,
        {
          status: 400,
          data: { error: 'invalid_grant' },
        } as never,
      );
      http.post.mockReturnValue(throwError(() => err));

      await expect(provider.exchangeCodeForToken('bad-code')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('error: throws BadGatewayException on unknown errors too', async () => {
      http.post.mockReturnValue(throwError(() => new Error('network down')));

      await expect(provider.exchangeCodeForToken('code')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('getUserInfo', () => {
    it('happy path: GETs Google userinfo with Bearer token and maps response', async () => {
      http.get.mockReturnValue(
        of(
          axiosResponse({
            sub: 'google-sub-123',
            email: 'mario@test.com',
            email_verified: true,
            name: 'Mario Souza',
            given_name: 'Mario',
            family_name: 'Souza',
            picture: 'https://cdn/picture.jpg',
          }),
        ),
      );

      const result = await provider.getUserInfo('access-token');

      expect(result).toEqual({
        providerAccountId: 'google-sub-123',
        email: 'mario@test.com',
        emailVerified: true,
        firstName: 'Mario',
        lastName: 'Souza',
        avatarUrl: 'https://cdn/picture.jpg',
      });

      expect(http.get).toHaveBeenCalledWith(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        expect.objectContaining({
          headers: { Authorization: 'Bearer access-token' },
        }),
      );
    });

    it('edge case: falls back to name split when given_name/family_name missing', async () => {
      http.get.mockReturnValue(
        of(
          axiosResponse({
            sub: 'google-sub-456',
            email: 'ana@test.com',
            email_verified: true,
            name: 'Ana Silva Costa',
          }),
        ),
      );

      const result = await provider.getUserInfo('access-token');

      expect(result.firstName).toBe('Ana');
      expect(result.lastName).toBe('Silva Costa');
    });

    it('edge case: firstName defaults to "User" when no name info at all', async () => {
      http.get.mockReturnValue(
        of(
          axiosResponse({
            sub: 'sub-1',
            email: 'x@test.com',
            email_verified: false,
          }),
        ),
      );

      const result = await provider.getUserInfo('access-token');

      expect(result.firstName).toBe('User');
      expect(result.lastName).toBeUndefined();
    });

    it('error: throws BadGatewayException on axios failure', async () => {
      const err = new AxiosError('Failed', 'ERR', undefined, undefined, {
        status: 401,
        data: { error: 'invalid_token' },
      } as never);
      http.get.mockReturnValue(throwError(() => err));

      await expect(provider.getUserInfo('bad-token')).rejects.toThrow(
        BadGatewayException,
      );
    });
  });
});
