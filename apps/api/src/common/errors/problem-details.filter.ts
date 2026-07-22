import { randomUUID } from 'node:crypto';

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { type ProblemDetails, REQUEST_ID_HEADER } from '@rpm/contracts';

import type { RequestWithCorrelation } from '../context/correlation-id.middleware';
import type { Response } from 'express';

function extractProblemCode(exceptionResponse: unknown, status: number): string {
  if (
    typeof exceptionResponse === 'object' &&
    exceptionResponse !== null &&
    'code' in exceptionResponse &&
    typeof (exceptionResponse as { code: unknown }).code === 'string'
  ) {
    return (exceptionResponse as { code: string }).code;
  }

  return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Partial<RequestWithCorrelation>>();
    const correlationId = request.correlationId ?? randomUUID();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    const detail =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof exceptionResponse === 'object' &&
            exceptionResponse !== null &&
            'message' in exceptionResponse
          ? Array.isArray((exceptionResponse as { message: unknown }).message)
            ? ((exceptionResponse as { message: string[] }).message.join('; ') ?? 'Request failed')
            : String((exceptionResponse as { message: unknown }).message)
          : status >= 500
            ? 'An unexpected error occurred.'
            : 'Request failed.';

    const problem: ProblemDetails = {
      type: `https://rpm.local/problems/${status}`,
      title: HttpStatus[status] ?? 'Error',
      status,
      detail,
      instance: request.originalUrl,
      code: extractProblemCode(exceptionResponse, status),
      requestId: correlationId,
      correlationId,
    };

    response.setHeader('Content-Type', 'application/problem+json');
    response.setHeader(REQUEST_ID_HEADER, correlationId);
    response.status(status).json(problem);
  }
}
