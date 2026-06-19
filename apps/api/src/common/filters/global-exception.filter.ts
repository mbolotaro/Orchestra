import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ErrorCode, ErrorResponse } from '@orchestra/schemas';
import type { Request, Response } from 'express';
import { ZodSerializationException, ZodValidationException } from 'nestjs-zod';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const requestId =
      (req.headers['x-request-id'] as string | undefined) ??
      `req_${randomUUID()}`;

    const body = this.toErrorResponse(exception, req, requestId);

    if (body.statusCode >= 500) {
      this.logger.error(
        { err: exception, requestId, path: body.path },
        'Internal server error',
      );
    }

    res.setHeader('X-Request-Id', requestId);
    res.status(body.statusCode).json(body);
  }

  private toErrorResponse(
    exception: unknown,
    req: Request,
    requestId: string,
  ): ErrorResponse {
    const base = {
      timestamp: new Date().toISOString(),
      path: req.url,
      requestId,
    };

    if (exception instanceof AppException) {
      return {
        code: exception.code,
        message: exception.message,
        statusCode: exception.getStatus(),
        details: exception.details,
        ...base,
      };
    }

    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as
        | {
            issues?: ReadonlyArray<{
              path: ReadonlyArray<PropertyKey>;
              message: string;
            }>;
          }
        | undefined;
      return {
        code: ErrorCode.ValidationFailed,
        message: 'Dados inválidos.',
        statusCode: HttpStatus.BAD_REQUEST,
        details: zodError?.issues
          ? { fieldErrors: groupZodIssues(zodError.issues) }
          : undefined,
        ...base,
      };
    }

    if (exception instanceof ZodSerializationException) {
      return {
        code: ErrorCode.InternalError,
        message: 'Erro interno do servidor.',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        ...base,
      };
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      return {
        code: mapStatusToCode(statusCode),
        message: extractMessage(exception),
        statusCode,
        ...base,
      };
    }

    return {
      code: ErrorCode.InternalError,
      message: 'Erro interno do servidor.',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      ...base,
    };
  }
}

function mapStatusToCode(status: number): ErrorCode {
  switch (status) {
    case 400:
      return ErrorCode.BadRequest;
    case 401:
      return ErrorCode.Unauthorized;
    case 403:
      return ErrorCode.Forbidden;
    case 404:
      return ErrorCode.ResourceNotFound;
    case 409:
      return ErrorCode.Conflict;
    case 429:
      return ErrorCode.RateLimited;
    default:
      return ErrorCode.InternalError;
  }
}

function groupZodIssues(
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_root';
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fieldErrors;
}

function extractMessage(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const msg = (response as Record<string, unknown>).message;
    if (typeof msg === 'string') return msg;
    if (Array.isArray(msg) && msg.every((m) => typeof m === 'string')) {
      return msg.join(', ');
    }
  }
  return exception.message;
}
