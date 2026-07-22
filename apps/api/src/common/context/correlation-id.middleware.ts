import { randomUUID } from 'node:crypto';

import { Injectable, type NestMiddleware } from '@nestjs/common';

import { REQUEST_ID_HEADER } from '@rpm/contracts';

import type { NextFunction, Request, Response } from 'express';

export type RequestWithCorrelation = Request & {
  correlationId: string;
  traceId: string;
};

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: RequestWithCorrelation, res: Response, next: NextFunction): void {
    const inbound = req.header(REQUEST_ID_HEADER);
    const correlationId =
      typeof inbound === 'string' && inbound.trim().length > 0 ? inbound.trim() : randomUUID();
    const traceId = randomUUID();

    req.correlationId = correlationId;
    req.traceId = traceId;
    res.setHeader(REQUEST_ID_HEADER, correlationId);
    res.setHeader('X-Trace-Id', traceId);
    next();
  }
}
