import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  OAuthProvider,
  PublicUser,
  PublicUserSchema,
} from '@orchestra/schemas';
import { randomBytes } from 'crypto';
import {
  OAuthStatePayload,
  OAuthStatePayloadSchema,
} from './schemas/oauth-state-payload.schema';
import { safeParseJson } from '../../../common/helpers/safe-parse-json.helper';
import { RedisService } from '../../redis/redis.service';
import { OAuthProvidersRegistry } from './providers/oauth-providers.registry';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../../users/users.service';
import { RefreshTokenService } from '../tokens/refresh-token.service';
import { TokenService } from '../tokens/token.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AccessTokenScope } from '../tokens/types/access-token.type';
import { EnvService } from '../../env/env.service';
import { SessionInfoPayload } from '../types/session-info.type';
import { OAuthUserInfo } from './types/oauth-user-info.interface';
import { OAuthAccountType } from '../../../generated/prisma/enums';
import { AuthStatus } from '../../../generated/prisma/enums';
import { TransactionClient } from '../../../generated/prisma/internal/prismaNamespace';
import { OAuthCallbackResult } from './types/oauth-callback-result.interface';

const OAUTH_STATE_PREFIX = 'oauth:state:';
const OAUTH_STATE_TTL_SECONDS = 300;

const providerToPrismaEnum: Record<OAuthProvider, OAuthAccountType> = {
  [OAuthProvider.Google]: OAuthAccountType.Google,
  [OAuthProvider.GitHub]: OAuthAccountType.GitHub,
};

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  constructor(
    private readonly redis: RedisService,
    private readonly providers: OAuthProvidersRegistry,
    private readonly prismaService: PrismaService,
    private readonly usersService: UsersService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly tokenService: TokenService,
    private readonly auditLogService: AuditLogService,
    private readonly env: EnvService,
  ) {}

  async start(provider: OAuthProvider, returnTo?: string): Promise<string> {
    try {
      const state = randomBytes(32).toString('base64url');

      const payload: OAuthStatePayload = {
        provider,
        returnTo,
        createdAt: Date.now(),
      };

      await this.redis.setEx(
        `${OAUTH_STATE_PREFIX}${state}`,
        OAUTH_STATE_TTL_SECONDS,
        JSON.stringify(payload),
      );

      const client = this.providers.get(provider);

      return client.getAuthorizeUrl(state);
    } catch (error) {
      this.logger.error({ error, provider }, 'start');

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível iniciar autenticação OAuth.',
      );
    }
  }

  async callback(
    provider: OAuthProvider,
    code: string,
    state: string,
    session: SessionInfoPayload,
  ): Promise<OAuthCallbackResult> {
    const now = new Date();

    try {
      const statePayload = await this.consumeState(state);

      if (statePayload.provider !== provider) {
        throw new BadRequestException(
          'Provider do state não corresponde ao callback.',
        );
      }

      const client = this.providers.get(provider);
      const tokenResponse = await client.exchangeCodeForToken(code);
      const userInfo = await client.getUserInfo(tokenResponse.accessToken);

      const user = await this.findOrCreateOAuthUser(provider, userInfo);

      const { token: refreshToken } = await this.refreshTokenService.issue(
        user.id,
        session,
      );
      const accessToken = await this.tokenService.signAccess(
        user.id,
        AccessTokenScope.Full,
      );

      await this.auditLogService
        .recordSignInLog({
          email: user.email,
          userId: user.id,
          status: AuthStatus.Success,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'oauth:callback'),
        );

      return {
        user,
        accessToken,
        refreshToken,
        redirectTo: statePayload.returnTo ?? this.env.get('FRONTEND_URL'),
      };
    } catch (error) {
      this.logger.error({ error, provider }, 'callback');

      await this.auditLogService
        .recordSignInLog({
          status: AuthStatus.Failed,
          ipAddress: session.ip,
          userAgent: session.userAgent,
          occurredAt: now,
        })
        .catch((logError: unknown) =>
          this.logger.error({ error: logError }, 'oauth:callback'),
        );

      if (error instanceof HttpException) throw error;

      throw new InternalServerErrorException(
        'Não foi possível concluir autenticação OAuth.',
      );
    }
  }

  private async consumeState(state: string): Promise<OAuthStatePayload> {
    const raw = await this.redis.getDel(`${OAUTH_STATE_PREFIX}${state}`);

    if (!raw) {
      throw new BadRequestException(
        'Estado OAuth inválido ou expirado. Refaça o login.',
      );
    }

    const parsed = safeParseJson(raw, OAuthStatePayloadSchema);

    if (!parsed) {
      this.logger.error({ raw }, 'consumeState: malformed state payload');
      throw new BadRequestException('Estado OAuth malformado.');
    }

    return parsed;
  }

  private async findOrCreateOAuthUser(
    provider: OAuthProvider,
    userInfo: OAuthUserInfo,
  ): Promise<PublicUser> {
    const prismaProvider = providerToPrismaEnum[provider];

    const existingAccount = await this.prismaService.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider: prismaProvider,
          providerId: userInfo.providerAccountId,
        },
      },
      include: { user: { omit: { passwordHash: true } } },
    });

    if (existingAccount) {
      return PublicUserSchema.parse(existingAccount.user);
    }

    if (userInfo.emailVerified) {
      const existingUser = await this.usersService.findByEmail(userInfo.email);
      if (existingUser) {
        await this.linkOAuthAccount(
          existingUser.id,
          prismaProvider,
          userInfo.providerAccountId,
        );
        return PublicUserSchema.parse(existingUser);
      }
    }

    return await this.usersService.create({
      kind: 'oauth',
      firstName: userInfo.firstName,
      lastName: userInfo.lastName ?? 'User',
      email: userInfo.email,
      oauthAccount: {
        provider: prismaProvider,
        providerId: userInfo.providerAccountId,
      },
    });
  }

  private async linkOAuthAccount(
    userId: string,
    provider: OAuthAccountType,
    providerId: string,
    tx?: TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prismaService;
    await client.oAuthAccount.create({
      data: { userId, provider, providerId },
    });
  }
}
