import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthCookieService } from '../auth-cookie.service';
import { ALLOW_UNVERIFIED_KEY } from '../decorators/allow-unverified.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ScopeUpgradeNeededException } from '../exceptions/scope-upgrade-needed.exception';
import { TokenService } from '../token.service';
import {
  AccessTokenPayload,
  AccessTokenScope,
} from '../types/access-token.type';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly tokenService: TokenService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const token = req.cookies?.[AuthCookieService.ACCESS_TOKEN] as
      | string
      | undefined;

    if (!token) {
      throw new UnauthorizedException('Não autenticado.');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.tokenService.verifyAccess(token);
    } catch (error) {
      this.logger.debug({ error }, 'canActivate');
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }

    if (payload.scope === AccessTokenScope.Unverified) {
      const allowUnverified = this.reflector.getAllAndOverride<boolean>(
        ALLOW_UNVERIFIED_KEY,
        [ctx.getHandler(), ctx.getClass()],
      );

      if (!allowUnverified) {
        throw new ScopeUpgradeNeededException({
          currentScope: payload.scope,
          requiredScope: AccessTokenScope.Full,
        });
      }
    }

    req.user = { sub: payload.sub, scope: payload.scope };
    return true;
  }
}
