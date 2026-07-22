import {
  type CallHandler,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';

import { StructuredLogger } from './structured-logger';

import type { RequestWithCorrelation } from '../context/correlation-id.middleware';
import type { Observable } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  constructor(@Inject(StructuredLogger) private readonly structuredLogger: StructuredLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<RequestWithCorrelation>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.structuredLogger.info('http.request.completed', {
            correlationId: request.correlationId,
            traceId: request.traceId,
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
          });
        },
        error: (error: unknown) => {
          const response = context.switchToHttp().getResponse<{ statusCode: number }>();
          this.structuredLogger.error('http.request.failed', {
            correlationId: request.correlationId,
            traceId: request.traceId,
            method: request.method,
            path: request.originalUrl,
            statusCode: response.statusCode,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : 'unknown',
          });
        },
      }),
    );
  }
}
