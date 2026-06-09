import { Injectable } from '@nestjs/common';
import { EnvService } from '../env/env.service';
import { CookieOptions, Response } from 'express';
import { durationToMs } from '../../common/helpers/parse-duration.helper';

@Injectable()
export class AuthCookieService {
  static readonly ACCESS_TOKEN = 'access_token';
  static readonly REFRESH_TOKEN = 'refresh_token';

  constructor(private readonly env: EnvService) {}

  set(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    const base = this.baseOptions();

    res.cookie(AuthCookieService.ACCESS_TOKEN, tokens.accessToken, {
      ...base,
      path: '/',
      maxAge: durationToMs(this.env.get('JWT_ACCESS_EXPIRATION')),
    });

    res.cookie(AuthCookieService.REFRESH_TOKEN, tokens.refreshToken, {
      ...base,
      path: '/auth',
      maxAge: durationToMs(this.env.get('JWT_REFRESH_EXPIRATION')),
    });
  }

  clear(res: Response): void {
    const base = this.baseOptions();
    res.clearCookie(AuthCookieService.ACCESS_TOKEN, { ...base, path: '/' });
    res.clearCookie(AuthCookieService.REFRESH_TOKEN, {
      ...base,
      path: '/auth',
    });
  }

  private baseOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.env.get('NODE_ENV') === 'production',
      sameSite: 'lax',
    };
  }
}
