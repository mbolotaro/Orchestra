import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ThrottlerLimitDetail } from '@nestjs/throttler/dist/throttler.guard.interface';
import type { Request } from 'express';
import { RateLimitedException } from '../../rate-limit/exceptions/rate-limited.exception';
import {
  RATE_LIMIT_METADATA_KEY,
  RATE_LIMIT_WINDOWS,
  type RateLimitOptions,
  type RateLimitStrategy,
} from '../rate-limit.constant';

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<
      RateLimitOptions | undefined
    >(RATE_LIMIT_METADATA_KEY, [context.getHandler(), context.getClass()]);

    if (options) {
      await this.enforceRateLimit(context, options);
    }

    return super.canActivate(context);
  }

  private async enforceRateLimit(
    context: ExecutionContext,
    options: RateLimitOptions,
  ): Promise<void> {
    const { req } = this.getRequestResponse(context);
    const config = RATE_LIMIT_WINDOWS[options.window];
    const strategies = Array.isArray(options.by) ? options.by : [options.by];

    for (const strategy of strategies) {
      const throttlerName = `${options.window}:${strategy}`;
      const tracker = this.getTrackerValue(req as Request, strategy);
      const key = this.generateKey(context, tracker, throttlerName);

      const { totalHits, timeToExpire, isBlocked, timeToBlockExpire } =
        await this.storageService.increment(
          key,
          config.ttl,
          config.limit,
          config.ttl,
          throttlerName,
        );

      if (isBlocked) {
        await this.throwThrottlingException(context, {
          limit: config.limit,
          ttl: config.ttl,
          key,
          tracker,
          totalHits,
          timeToExpire,
          isBlocked,
          timeToBlockExpire,
        });
      }
    }
  }

  protected throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(1, detail.timeToBlockExpire);
    throw new RateLimitedException(undefined, { retryAfterSeconds });
  }

  private getTrackerValue(req: Request, strategy: RateLimitStrategy): string {
    switch (strategy) {
      case 'email': {
        const body = req.body as { email?: string } | undefined;
        return body?.email?.toLowerCase() ?? 'unknown-email';
      }
      case 'user': {
        const user = req.user;
        return user?.sub ?? 'unknown-user';
      }
      case 'ip':
      default:
        return req.ip ?? 'unknown';
    }
  }
}
