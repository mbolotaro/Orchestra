import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SessionInfo } from './decorators/session-info.decorator';
import { type SessionInfoPayload } from './types/session-info.type';
import { type Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { ZodSerializerDto } from 'nestjs-zod';
import { PublicAuthDto } from './dto/public-auth.dto';
import { SignInDto } from './dto/signin.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { type RequestUser } from './types/request-user.type';
import { PublicAuth } from '@orchestra/schemas';

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

  @Get('me')
  @ZodSerializerDto(PublicAuthDto)
  async me(@CurrentUser() { sub }: RequestUser): Promise<PublicAuth> {
    return await this.authService.me(sub);
  }
}
