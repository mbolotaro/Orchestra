import 'express';
import type { AccessTokenScope } from '../tokens/types/access-token.type';

export interface RequestUser {
  sub: string;
  scope: AccessTokenScope;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}
