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
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenService } from '../token.service';

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

    try {
      const payload = await this.tokenService.verifyAccess(token);
      req.user = { sub: payload.sub };
      return true;
    } catch (error) {
      this.logger.debug({ error }, 'canActivate');
      throw new UnauthorizedException('Sessão inválida ou expirada.');
    }
  }
}
