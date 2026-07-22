import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  EMPTY_PAGINATION_EXAMPLE,
  type MetaIdempotentEchoRequest,
  type MetaIdempotentEchoResponse,
  type MetaPaginationExampleResponse,
  type OperationsCollection,
  normalizePaginationLimit,
} from '@rpm/contracts';

import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { actorScopeFromOrganization } from '../../infrastructure/persistence/organization-context';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';

import type { Request, Response } from 'express';

const IDEMPOTENT_ECHO_OPERATION = 'POST /v1/meta/idempotent-echo' as const;

@Injectable()
export class MetaService {
  constructor(
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(OutboxService) private readonly outbox: OutboxService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService,
  ) {}

  paginationExample(limit?: number): MetaPaginationExampleResponse {
    return {
      ...EMPTY_PAGINATION_EXAMPLE,
      page: {
        ...EMPTY_PAGINATION_EXAMPLE.page,
        limit: normalizePaginationLimit(limit),
      },
    };
  }

  listOperations(): OperationsCollection {
    return {
      data: [],
      page: {
        nextCursor: null,
        previousCursor: null,
        limit: 25,
      },
      meta: {},
    };
  }

  async idempotentEcho(
    request: Request,
    response: Response,
    body: MetaIdempotentEchoRequest,
    correlationId: string | undefined,
  ): Promise<MetaIdempotentEchoResponse> {
    const idempotencyKey = this.idempotency.parseHeader(request);
    const requestHash = this.idempotency.hashRequest(request.method, request.path, body);
    const actorScope = actorScopeFromOrganization(null);

    const echoResponse: MetaIdempotentEchoResponse = {
      message: body.message,
      echoId: randomUUID(),
      timestamp: new Date().toISOString(),
      service: 'api',
    };

    const result = await this.transactions.run(async (tx) => {
      const idempotencyResult = await this.idempotency.resolveOrCreate(tx, {
        tenantId: null,
        actorScope,
        operation: IDEMPOTENT_ECHO_OPERATION,
        key: idempotencyKey,
        requestHash,
        responseStatus: 200,
        responseBody: echoResponse,
      });

      if (!idempotencyResult.replayed) {
        await this.outbox.appendInTransaction(tx, {
          aggregateType: 'meta.idempotent_echo',
          aggregateId: echoResponse.echoId,
          eventType: 'meta.idempotent_echo.created',
          payload: {
            message: body.message,
            echoId: echoResponse.echoId,
          },
          correlationId,
          tenantId: undefined,
        });
      }

      return idempotencyResult;
    });

    this.idempotency.writeReplayHeader(response, result.replayed);
    return result.body as MetaIdempotentEchoResponse;
  }
}
