import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, type DeepMockProxy } from 'jest-mock-extended';
import { EnvService } from '../../env/env.service';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from '../types/access-token.type';
import { TokenService } from '../token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwt: DeepMockProxy<JwtService>;
  let env: DeepMockProxy<EnvService>;

  beforeEach(async () => {
    jwt = mockDeep<JwtService>();
    env = mockDeep<EnvService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwt },
        { provide: EnvService, useValue: env },
      ],
    }).compile();

    service = module.get(TokenService);
  });

  it('happy path: is instantiated with its dependencies', () => {
    expect(service).toBeDefined();
  });

  describe('signAccess', () => {
    it('happy path: signs access token with payload and env expiration', async () => {
      env.get.mockReturnValue('15m');
      jwt.signAsync.mockResolvedValue('signed.access.token');

      const token = await service.signAccess('user-123');

      expect(token).toBe('signed.access.token');
      expect(env.get).toHaveBeenCalledWith('JWT_ACCESS_EXPIRATION');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        { sub: 'user-123', type: 'access' },
        { expiresIn: '15m' },
      );
    });
  });

  describe('signRefresh', () => {
    it('happy path: signs refresh token with payload, jti and env expiration', async () => {
      env.get.mockReturnValue('7d');
      jwt.signAsync.mockResolvedValue('signed.refresh.token');

      const token = await service.signRefresh('user-123', 'jti-abc');

      expect(token).toBe('signed.refresh.token');
      expect(env.get).toHaveBeenCalledWith('JWT_REFRESH_EXPIRATION');
      expect(jwt.signAsync).toHaveBeenCalledWith(
        {
          sub: 'user-123',
          type: 'refresh',
          jti: 'jti-abc',
        } satisfies RefreshTokenPayload,
        { expiresIn: '7d' },
      );
    });
  });

  describe('verifyAccess', () => {
    it('happy path: returns payload when token is a valid access token', async () => {
      const payload: AccessTokenPayload = { sub: 'user-123', type: 'access' };
      jwt.verifyAsync.mockResolvedValue(payload);

      await expect(service.verifyAccess('token')).resolves.toEqual(payload);
    });

    it('error: throws UnauthorizedException when type is not access', async () => {
      jwt.verifyAsync.mockResolvedValue({
        sub: 'user-123',
        type: 'refresh',
        jti: 'x',
      });

      await expect(service.verifyAccess('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('error: rethrows jwt error (expired, malformed signature)', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.verifyAccess('token')).rejects.toThrow(
        'jwt expired',
      );
    });
  });

  describe('verifyRefresh', () => {
    it('happy path: returns payload when token is a valid refresh token', async () => {
      const payload: RefreshTokenPayload = {
        sub: 'user-123',
        type: 'refresh',
        jti: 'jti-abc',
      };
      jwt.verifyAsync.mockResolvedValue(payload);

      await expect(service.verifyRefresh('token')).resolves.toEqual(payload);
    });

    it('error: throws UnauthorizedException when type is not refresh', async () => {
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-123', type: 'access' });

      await expect(service.verifyRefresh('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('error: rethrows underlying jwt error', async () => {
      jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      await expect(service.verifyRefresh('token')).rejects.toThrow(
        'invalid signature',
      );
    });
  });

  describe('decodeUnsafe', () => {
    it('happy path: returns payload when decode returns an object', () => {
      jwt.decode.mockReturnValue({ sub: 'user-123', jti: 'jti-abc' });

      expect(service.decodeUnsafe('token')).toEqual({
        sub: 'user-123',
        jti: 'jti-abc',
      });
    });

    it('edge case: returns null when decode returns null', () => {
      jwt.decode.mockReturnValue(null);

      expect(service.decodeUnsafe('token')).toBeNull();
    });

    it('edge case: returns null when decode returns a non-object value', () => {
      jwt.decode.mockReturnValue('string-token');

      expect(service.decodeUnsafe('token')).toBeNull();
    });

    it('edge case: returns null when decode throws internally', () => {
      jwt.decode.mockImplementation(() => {
        throw new Error('boom');
      });

      expect(service.decodeUnsafe('token')).toBeNull();
    });
  });
});
