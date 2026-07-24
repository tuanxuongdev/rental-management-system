import { createHash } from 'node:crypto';

import {
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IdempotencyKeyStatus } from '@prisma/client';

import {
  IDEMPOTENCY_DEFAULT_TTL_HOURS,
  IDEMPOTENCY_KEY_HEADER,
  IDEMPOTENCY_REPLAYED_HEADER,
  idempotencyKeyHeaderSchema,
} from '@rpm/contracts';

import { isPrismaUniqueViolation } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.module';

import type { ActorScope } from '../persistence/organization-context';
import type { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export type IdempotencyRecordResult = {
  replayed: boolean;
  statusCode: number;
  body: unknown;
};

@Injectable()
export class IdempotencyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  parseHeader(request: Request): string {
    const raw = request.header(IDEMPOTENCY_KEY_HEADER);
    const parsed = idempotencyKeyHeaderSchema.safeParse(raw);
    if (!parsed.success) {
      throw new UnprocessableEntityException({
        message: 'Idempotency-Key header is required and must be 1-128 printable ASCII characters',
        code: 'IDEMPOTENCY_KEY_REQUIRED',
      });
    }
    return parsed.data;
  }

  hashRequest(method: string, path: string, body: unknown): string {
    const canonical = JSON.stringify({ method: method.toUpperCase(), path, body });
    return createHash('sha256').update(canonical).digest('hex');
  }

  async findExisting(
    tenantId: string | null,
    actorScope: ActorScope,
    operation: string,
    key: string,
  ) {
    return this.prisma.idempotencyKey.findFirst({
      where: {
        tenantId,
        actorScope,
        operation,
        key,
      },
    });
  }

  async resolveOrCreate(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string | null;
      actorScope: ActorScope;
      operation: string;
      key: string;
      requestHash: string;
      responseStatus: number;
      responseBody: unknown;
    },
  ): Promise<IdempotencyRecordResult> {
    const existing = await tx.idempotencyKey.findFirst({
      where: {
        tenantId: input.tenantId,
        actorScope: input.actorScope,
        operation: input.operation,
        key: input.key,
      },
    });

    if (existing !== null) {
      if (existing.expiresAt <= new Date()) {
        await tx.idempotencyKey.delete({ where: { id: existing.id } });
      } else if (existing.requestHash !== input.requestHash) {
        throw new ConflictException({
          message: 'Idempotency key was already used with a different request body',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      } else if (existing.status === IdempotencyKeyStatus.COMPLETED) {
        return {
          replayed: true,
          statusCode: existing.responseStatus,
          body: existing.responseBody,
        };
      } else if (existing.status === IdempotencyKeyStatus.PROCESSING) {
        throw new ConflictException({
          message: 'Idempotency key is already being processed',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      } else {
        return {
          replayed: true,
          statusCode: existing.responseStatus,
          body: existing.responseBody,
        };
      }
    }

    try {
      await tx.idempotencyKey.create({
        data: {
          tenantId: input.tenantId,
          actorScope: input.actorScope,
          operation: input.operation,
          key: input.key,
          requestHash: input.requestHash,
          status: IdempotencyKeyStatus.COMPLETED,
          responseStatus: input.responseStatus,
          responseBody: input.responseBody as Prisma.InputJsonValue,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_DEFAULT_TTL_HOURS * 60 * 60 * 1000),
        },
      });
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        throw error;
      }

      const raced = await tx.idempotencyKey.findFirst({
        where: {
          tenantId: input.tenantId,
          actorScope: input.actorScope,
          operation: input.operation,
          key: input.key,
        },
      });

      if (raced === null) {
        throw error;
      }

      if (raced.requestHash !== input.requestHash) {
        throw new ConflictException({
          message: 'Idempotency key was already used with a different request body',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }

      if (raced.status === IdempotencyKeyStatus.PROCESSING) {
        throw new ConflictException({
          message: 'Idempotency key is already being processed',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      }

      return {
        replayed: true,
        statusCode: raced.responseStatus,
        body: raced.responseBody,
      };
    }

    return {
      replayed: false,
      statusCode: input.responseStatus,
      body: input.responseBody,
    };
  }

  /**
   * Reserve an idempotency key at the start of a money transaction (O2).
   * Returns a replay when a prior COMPLETED response exists for the same hash.
   */
  async begin(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string | null;
      actorScope: ActorScope;
      operation: string;
      key: string;
      requestHash: string;
    },
  ): Promise<{ replayed: true; statusCode: number; body: unknown } | { replayed: false }> {
    const existing = await tx.idempotencyKey.findFirst({
      where: {
        tenantId: input.tenantId,
        actorScope: input.actorScope,
        operation: input.operation,
        key: input.key,
      },
    });

    if (existing !== null) {
      if (existing.expiresAt <= new Date()) {
        await tx.idempotencyKey.delete({ where: { id: existing.id } });
      } else if (existing.requestHash !== input.requestHash) {
        throw new ConflictException({
          message: 'Idempotency key was already used with a different request body',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      } else if (existing.status === IdempotencyKeyStatus.COMPLETED) {
        return {
          replayed: true,
          statusCode: existing.responseStatus,
          body: existing.responseBody,
        };
      } else if (existing.status === IdempotencyKeyStatus.PROCESSING) {
        throw new ConflictException({
          message: 'Idempotency key is already being processed',
          code: 'IDEMPOTENCY_IN_PROGRESS',
        });
      }
    }

    try {
      await tx.idempotencyKey.create({
        data: {
          tenantId: input.tenantId,
          actorScope: input.actorScope,
          operation: input.operation,
          key: input.key,
          requestHash: input.requestHash,
          status: IdempotencyKeyStatus.PROCESSING,
          responseStatus: 0,
          responseBody: {},
          expiresAt: new Date(Date.now() + IDEMPOTENCY_DEFAULT_TTL_HOURS * 60 * 60 * 1000),
        },
      });
      return { replayed: false };
    } catch (error) {
      if (!isPrismaUniqueViolation(error)) {
        throw error;
      }
      const raced = await tx.idempotencyKey.findFirst({
        where: {
          tenantId: input.tenantId,
          actorScope: input.actorScope,
          operation: input.operation,
          key: input.key,
        },
      });
      if (raced === null) {
        throw error;
      }
      if (raced.requestHash !== input.requestHash) {
        throw new ConflictException({
          message: 'Idempotency key was already used with a different request body',
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      if (raced.status === IdempotencyKeyStatus.COMPLETED) {
        return {
          replayed: true,
          statusCode: raced.responseStatus,
          body: raced.responseBody,
        };
      }
      throw new ConflictException({
        message: 'Idempotency key is already being processed',
        code: 'IDEMPOTENCY_IN_PROGRESS',
      });
    }
  }

  async complete(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string | null;
      actorScope: ActorScope;
      operation: string;
      key: string;
      responseStatus: number;
      responseBody: unknown;
    },
  ): Promise<void> {
    await tx.idempotencyKey.updateMany({
      where: {
        tenantId: input.tenantId,
        actorScope: input.actorScope,
        operation: input.operation,
        key: input.key,
      },
      data: {
        status: IdempotencyKeyStatus.COMPLETED,
        responseStatus: input.responseStatus,
        responseBody: input.responseBody as Prisma.InputJsonValue,
      },
    });
  }

  writeReplayHeader(response: Response, replayed: boolean): void {
    response.setHeader(IDEMPOTENCY_REPLAYED_HEADER, replayed ? 'true' : 'false');
  }

  assertHttpException(error: unknown): never {
    if (error instanceof HttpException) {
      throw error;
    }
    throw error;
  }
}
