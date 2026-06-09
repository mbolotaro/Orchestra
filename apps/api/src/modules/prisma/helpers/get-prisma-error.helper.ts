import { Prisma } from '../../../generated/prisma/client';

export type PrismaErrorInfo =
  | { kind: 'unique'; field?: string }
  | { kind: 'not_found' }
  | { kind: 'unknown' };

export const getPrismaError = (error: unknown): PrismaErrorInfo => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return { kind: 'unique', field: extractUniqueField(error.meta) };
      case 'P2025':
        return { kind: 'not_found' };
    }
  }

  return { kind: 'unknown' };
};

function extractUniqueField(meta: unknown): string | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as Record<string, unknown>;

  if (Array.isArray(m.target)) {
    return (m.target as string[]).join(', ');
  }
  if (typeof m.target === 'string') {
    return m.target;
  }

  const driverError = m.driverAdapterError as
    | { cause?: { constraint?: { fields?: string[] } } }
    | undefined;
  const fields = driverError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) {
    return fields.join(', ');
  }

  return undefined;
}
