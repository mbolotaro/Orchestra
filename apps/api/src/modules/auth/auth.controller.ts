import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SessionInfo } from './decorators/session-info.decorator';
import { type SessionInfoPayload } from './types/session-info.type';
import { type Request, type Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { ZodSerializerDto } from 'nestjs-zod';
import { PublicAuthDto } from './dto/public-auth.dto';
import { SignInDto } from './dto/signin.dto';
import { Public } from './decorators/public.decorator';
import { AllowUnverified } from './decorators/allow-unverified.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { type RequestUser } from './types/request-user.type';
import { PublicAuth } from '@orchestra/schemas';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Public()
  @Post('sign-up')
  @ZodSerializerDto(PublicAuthDto)
  async signUp(
    @SessionInfo() session: SessionInfoPayload,
    @Body() signUpDto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuth> {
    const { user, accessToken, refreshToken } = await this.authService.signUp(
      signUpDto,
      session,
    );

    this.authCookieService.set(res, { accessToken, refreshToken });

    return { user };
  }

  @Public()
  @Post('sign-in')
  @ZodSerializerDto(PublicAuthDto)
  async signIn(
    @SessionInfo() session: SessionInfoPayload,
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicAuth> {
    const { user, accessToken, refreshToken } = await this.authService.signIn(
      signInDto,
      session,
    );

    this.authCookieService.set(res, { accessToken, refreshToken });

    return { user };
  }

  @Public()
  @Post('refresh')
  @ZodSerializerDto(PublicAuthDto)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @SessionInfo() session: SessionInfoPayload,
  ): Promise<PublicAuth> {
    const { refreshToken: oldRefreshToken } = this.authCookieService.get(req);

    if (!oldRefreshToken) throw new UnauthorizedException('Não autenticado.');

    const { accessToken, refreshToken, user } = await this.authService.refresh(
      oldRefreshToken,
      session,
    );

    this.authCookieService.set(res, { accessToken, refreshToken });

    return { user };
  }

  @Public()
  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @SessionInfo() session: SessionInfoPayload,
  ): Promise<void> {
    const { refreshToken } = this.authCookieService.get(req);
    await this.authService.signOut(refreshToken!, session);
    this.authCookieService.clear(res);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(
    @Body() body: VerifyEmailDto,
    @SessionInfo() sessionInfo: SessionInfoPayload,
  ): Promise<void> {
    await this.authService.verifyEmail(body.token, sessionInfo);
  }

  @AllowUnverified()
  @Get('me')
  @ZodSerializerDto(PublicAuthDto)
  async me(@CurrentUser() { sub }: RequestUser): Promise<PublicAuth> {
    return await this.authService.me(sub);
  }
}
