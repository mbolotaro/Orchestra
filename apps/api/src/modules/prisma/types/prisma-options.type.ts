import { PrismaClient } from '../../../generated/prisma/client';

export interface PrismaOptions {
  transaction: PrismaClient;
}
