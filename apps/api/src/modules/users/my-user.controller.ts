import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Res,
} from '@nestjs/common';
import { AllowUnverified } from '../auth/decorators/allow-unverified.decorator';
import { ZodSerializerDto } from 'nestjs-zod';
import { PublicAuth } from '@orchestra/schemas';
import { type RequestUser } from '../auth/types/request-user.type';
import { UsersService } from './users.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PublicAuthDto } from '../auth/dto/public-auth.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SessionInfo } from '../auth/decorators/session-info.decorator';
import { type SessionInfoPayload } from '../auth/types/session-info.type';
import { AuthCookieService } from '../auth/auth-cookie.service';
import { RefreshTokenService } from '../auth/tokens/refresh-token.service';
import { AuditLogService } from '../auth/audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthStatus } from '../../generated/prisma/enums';
import { type Response } from 'express';

@Controller('users/me')
export class MyUserController {
  constructor(
    private readonly userService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly auditLogService: AuditLogService,
    private readonly authCookieService: AuthCookieService,
    private readonly prismaService: PrismaService,
  ) {}

  @AllowUnverified()
  @Get()
  @ZodSerializerDto(PublicAuthDto)
  async me(@CurrentUser() { sub }: RequestUser): Promise<PublicAuth> {
    const user = await this.userService.getById(sub);

    return { user };
  }

  @Patch()
  @ZodSerializerDto(PublicAuthDto)
  async update(
    @CurrentUser() { sub }: RequestUser,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<PublicAuth> {
    const updatedUser = await this.userService.update(sub, updateUserDto);

    return { user: updatedUser };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() { sub }: RequestUser,
    @SessionInfo() session: SessionInfoPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const user = await this.userService.getById(sub);

    await this.prismaService.$transaction(async (tx) => {
      await this.userService.softDelete(sub, tx);
      await this.refreshTokenService.revokeAllForUser(sub, tx);
      await this.auditLogService.recordDeleteAccountLog(
        {
          userId: user.id,
          email: user.email,
          status: AuthStatus.Success,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: new Date(),
        },
        tx,
      );
    });

    this.authCookieService.clear(res);
  }
}
