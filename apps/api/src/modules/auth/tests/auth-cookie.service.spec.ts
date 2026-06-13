import { Test, TestingModule } from '@nestjs/testing';
import type { Request, Response } from 'express';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { AuthCookieService } from '../auth-cookie.service';
import { EnvService } from '../../env/env.service';

describe('AuthCookieService', () => {
  let service: AuthCookieService;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    env = mockDeep<EnvService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthCookieService, { provide: EnvService, useValue: env }],
    }).compile();

    service = module.get(AuthCookieService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('get', () => {
    it('happy path: returns access and refresh tokens from request cookies', () => {
      const req = {
        cookies: {
          access_token: 'access-value',
          refresh_token: 'refresh-value',
        },
      } as unknown as Request;

      expect(service.get(req)).toEqual({
        accessToken: 'access-value',
        refreshToken: 'refresh-value',
      });
    });

    it('edge case: returns undefined fields when cookies object is missing', () => {
      const req = {} as unknown as Request;

      expect(service.get(req)).toEqual({
        accessToken: undefined,
        refreshToken: undefined,
      });
    });

    it('edge case: returns undefined for tokens that are not present', () => {
      const req = { cookies: { other_cookie: 'x' } } as unknown as Request;

      expect(service.get(req)).toEqual({
        accessToken: undefined,
        refreshToken: undefined,
      });
    });
  });

  describe('set', () => {
    it('happy path: sets access cookie at path / with httpOnly, sameSite lax and env expiration', () => {
      env.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        if (key === 'NODE_ENV') return 'development';
        return '';
      });
      const res = mockDeep<Response>();

      service.set(res, {
        accessToken: 'access-value',
        refreshToken: 'refresh-value',
      });

      expect(res.cookie).toHaveBeenCalledWith(
        AuthCookieService.ACCESS_TOKEN,
        'access-value',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          path: '/',
          maxAge: 15 * 60 * 1000,
        }),
      );
    });

    it('happy path: sets refresh cookie at path /auth with httpOnly and env expiration', () => {
      env.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        if (key === 'NODE_ENV') return 'development';
        return '';
      });
      const res = mockDeep<Response>();

      service.set(res, {
        accessToken: 'access-value',
        refreshToken: 'refresh-value',
      });

      expect(res.cookie).toHaveBeenCalledWith(
        AuthCookieService.REFRESH_TOKEN,
        'refresh-value',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          path: '/auth',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        }),
      );
    });

    it('happy path: sets secure=true when NODE_ENV is production', () => {
      env.get.mockImplementation((key: string) => {
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        if (key === 'JWT_REFRESH_EXPIRATION') return '7d';
        if (key === 'NODE_ENV') return 'production';
        return '';
      });
      const res = mockDeep<Response>();

      service.set(res, {
        accessToken: 'access-value',
        refreshToken: 'refresh-value',
      });

      expect(res.cookie).toHaveBeenCalledWith(
        AuthCookieService.ACCESS_TOKEN,
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
      expect(res.cookie).toHaveBeenCalledWith(
        AuthCookieService.REFRESH_TOKEN,
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );
    });
  });

  describe('clear', () => {
    it('happy path: clears access cookie at path / and refresh at path /auth', () => {
      env.get.mockReturnValue('development');
      const res = mockDeep<Response>();

      service.clear(res);

      expect(res.clearCookie).toHaveBeenCalledWith(
        AuthCookieService.ACCESS_TOKEN,
        expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' }),
      );
      expect(res.clearCookie).toHaveBeenCalledWith(
        AuthCookieService.REFRESH_TOKEN,
        expect.objectContaining({
          path: '/auth',
          httpOnly: true,
          sameSite: 'lax',
        }),
      );
    });
  });
});
