import { Body, Controller, Post, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SessionInfo } from './decorators/session-info.decorator';
import { type SessionInfoPayload } from './types/session-info.type';
import { type Response } from 'express';
import { AuthCookieService } from './auth-cookie.service';
import { ZodSerializerDto } from 'nestjs-zod';
import { PublicAuthDto } from './dto/public-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  @Post('sign-up')
  @ZodSerializerDto(PublicAuthDto)
  async signUp(
    @SessionInfo() session: SessionInfoPayload,
    @Body() signUpDto: SignUpDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.authService.signUp(
      signUpDto,
      session,
    );

    this.authCookieService.set(res, { accessToken, refreshToken });

    return { user };
  }

  @Post('sign-in')
  async signIn() {}
}
