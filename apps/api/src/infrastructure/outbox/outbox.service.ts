import { Inject, Injectable } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.module';

import type { Prisma } from '@prisma/client';

export type OutboxAppendInput = {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string | undefined;
  tenantId?: string | undefined;
  sequence?: number | undefined;
};

@Injectable()
export class OutboxService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async appendInTransaction(
    tx: Prisma.TransactionClient,
    input: OutboxAppendInput,
  ): Promise<{ id: string }> {
    const event = await tx.outboxEvent.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        sequence: input.sequence ?? 1,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        correlationId: input.correlationId,
        tenantId: input.tenantId,
        status: OutboxEventStatus.PENDING,
      },
      select: { id: true },
    });

    return event;
  }

  async countPending(): Promise<number> {
    return this.prisma.outboxEvent.count({
      where: { status: OutboxEventStatus.PENDING },
    });
  }
}
