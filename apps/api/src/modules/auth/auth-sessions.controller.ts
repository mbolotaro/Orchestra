import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Req,
} from '@nestjs/common';
import { CurrentUser } from './decorators/current-user.decorator';
import { type RequestUser } from './types/request-user.type';
import { AuthService } from './auth.service';
import { ZodSerializerDto } from 'nestjs-zod';
import { PublicAuthSessionListDto } from './dto/public-auth-session-list.dto';
import { type Request } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { RateLimit } from '../rate-limit/decorators/rate-limit.decorator';

@Controller('auth/sessions')
export class AuthSessionsController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Get()
  @ZodSerializerDto(PublicAuthSessionListDto)
  async getActiveSessions(
    @CurrentUser() { sub }: RequestUser,
    @Req() req: Request,
  ): Promise<PublicAuthSessionListDto> {
    const { refreshToken } = this.authCookieService.get(req);
    return await this.authService.listSessions(sub, refreshToken);
  }

  @Delete(':id')
  @RateLimit({ window: 'short', by: 'user' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() { sub }: RequestUser,
    @Param('id') sessionId: string,
    @Req() req: Request,
  ): Promise<void> {
    const { refreshToken } = this.authCookieService.get(req);
    await this.authService.revokeSession(sub, sessionId, refreshToken);
  }

  @Delete()
  @RateLimit({ window: 'strict', by: 'user' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllOtherSessions(
    @CurrentUser() { sub }: RequestUser,
    @Req() req: Request,
  ): Promise<void> {
    const { refreshToken } = this.authCookieService.get(req);
    await this.authService.revokeAllOtherSessions(sub, refreshToken);
  }
}
