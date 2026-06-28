import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

// Error codes that are safe to expose
const SAFE_HTTP_CODES = [400, 401, 403, 404, 409, 422, 429];

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';
    let code = 'INTERNAL_ERROR';
    let errors: unknown[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp.message as string) || exception.message;
        code = (resp.code as string) || this.statusToCode(status);
        errors = Array.isArray(resp.message) ? (resp.message as unknown[]) : undefined;
        if (errors) message = 'Validation failed';
      } else {
        message = exceptionResponse as string;
        code = this.statusToCode(status);
      }
    } else if (exception instanceof QueryFailedError) {
      // Database errors — never expose raw SQL or constraint details
      this.logger.error('Database error', {
        message: exception.message,
        query: exception.query, // logged only, not sent to client
        path: request.url,
      });

      // Detect unique constraint violations
      if ((exception as any).code === '23505') {
        status = HttpStatus.CONFLICT;
        message = 'A record with this value already exists';
        code = 'DUPLICATE_ENTRY';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        message = 'A database error occurred';
        code = 'DATABASE_ERROR';
      }
    } else if (exception instanceof Error) {
      this.logger.error('Unhandled error', {
        message: exception.message,
        stack: exception.stack,
        path: request.url,
      });
    } else {
      this.logger.error('Unknown exception type', { exception, path: request.url });
    }

    // Log all errors
    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status}`, {
        exception: exception instanceof Error ? exception.message : exception,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
    } else if (status === 401 || status === 403) {
      this.logger.warn(`${request.method} ${request.url} → ${status}`, {
        ip: request.ip,
      });
    }

    // OWASP: Never expose internal error details to client for 5xx
    if (status >= 500) {
      message = 'An unexpected error occurred. Please contact support if this persists.';
      code = 'INTERNAL_ERROR';
      errors = undefined;
    }

    const responseBody: Record<string, unknown> = {
      statusCode: status,
      code,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (errors && SAFE_HTTP_CODES.includes(status)) {
      responseBody.errors = errors;
    }

    response.status(status).json(responseBody);
  }

  private statusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codes[status] || 'ERROR';
  }
}
