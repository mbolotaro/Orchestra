import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvService } from '../env/env.service';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/access-token.type';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly env: EnvService,
  ) {}

  async signAccess(sub: string): Promise<string> {
    const payload: AccessTokenPayload = { sub, type: 'access' };

    return await this.jwt.signAsync(payload, {
      expiresIn: this.env.get('JWT_ACCESS_EXPIRATION'),
    });
  }

  async signRefresh(sub: string, jti: string): Promise<string> {
    const payload: RefreshTokenPayload = { sub, type: 'refresh', jti };

    return await this.jwt.signAsync(payload, {
      expiresIn: this.env.get('JWT_REFRESH_EXPIRATION'),
    });
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Token inválido!');
    }

    return payload;
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token);

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Token inválido!');
    }

    return payload;
  }
}
