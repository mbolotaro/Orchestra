import { Controller, Get, Logger, Param, Query, Res } from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OAuthProvider, OAuthProviderSchema } from '@orchestra/schemas';
import { ZodValidationPipe } from 'nestjs-zod';
import { type Response } from 'express';
import { Public } from '../decorators/public.decorator';
import { SessionInfo } from '../decorators/session-info.decorator';
import { type SessionInfoPayload } from '../types/session-info.type';
import { AuthCookieService } from '../auth-cookie.service';
import { EnvService } from '../../env/env.service';

@Controller('auth/oauth')
export class OAuthController {
  private readonly logger = new Logger(OAuthController.name);

  constructor(
    private readonly oAuthService: OAuthService,
    private readonly authCookieService: AuthCookieService,
    private readonly env: EnvService,
  ) {}

  @Public()
  @Get(':provider')
  async start(
    @Param('provider', new ZodValidationPipe(OAuthProviderSchema))
    provider: OAuthProvider,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const authorizeUrl = await this.oAuthService.start(provider, returnTo);
    res.redirect(302, authorizeUrl);
  }

  @Public()
  @Get(':provider/callback')
  async callback(
    @Param('provider', new ZodValidationPipe(OAuthProviderSchema))
    provider: OAuthProvider,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @SessionInfo() session: SessionInfoPayload,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.env.get('FRONTEND_URL');

    if (error) {
      return res.redirect(
        302,
        `${frontendUrl}?oauth_error=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.redirect(302, `${frontendUrl}?oauth_error=missing_params`);
    }

    try {
      const { accessToken, refreshToken, redirectTo } =
        await this.oAuthService.callback(provider, code, state, session);

      this.authCookieService.set(res, { accessToken, refreshToken });
      return res.redirect(302, redirectTo);
    } catch (err) {
      this.logger.error({ err }, 'oauth callback failed');
      return res.redirect(302, `${frontendUrl}?oauth_error=oauth_failed`);
    }
  }
}
