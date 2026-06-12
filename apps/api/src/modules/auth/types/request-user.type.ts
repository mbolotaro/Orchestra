import 'express';

export interface RequestUser {
  sub: string;
}

declare module 'express' {
  interface Request {
    user?: RequestUser;
  }
}
