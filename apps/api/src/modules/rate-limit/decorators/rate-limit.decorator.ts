import { SetMetadata } from '@nestjs/common';
import {
  RATE_LIMIT_METADATA_KEY,
  type RateLimitOptions,
} from '../rate-limit.constant';

export function RateLimit(options: RateLimitOptions) {
  return SetMetadata(RATE_LIMIT_METADATA_KEY, options);
}
