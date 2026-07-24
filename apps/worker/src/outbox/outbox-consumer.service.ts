import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';

import {
  BILLING_RUN_COMMIT_EVENT_TYPE,
  isBillingRunCommitPayload,
  processBillingRunCommit,
} from '../handlers/billing-run.handler';
import {
  INVENTORY_IMPORT_COMMIT_EVENT,
  processInventoryImportCommit,
  type InventoryImportCommitPayload,
} from '../handlers/inventory-import.handler';
import { PrismaService } from '../infrastructure/prisma/prisma.module';

import { validateOutboxTenantContext } from './tenant-context';

const CONSUMER_NAME = 'rpm.worker.outbox' as const;
const POLL_INTERVAL_MS = 2_000 as const;

function isPrismaUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class OutboxConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxConsumerService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.poll();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
    }
  }

  async poll(): Promise<number> {
    const pending = await this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxEventStatus.PENDING,
        availableAt: { lte: new Date() },
      },
      orderBy: { occurredAt: 'asc' },
      take: 25,
      select: {
        id: true,
        eventType: true,
        correlationId: true,
        tenantId: true,
        payload: true,
      },
    });

    let processed = 0;

    for (const event of pending) {
      const didProcess = await this.processEvent(event);
      if (didProcess) {
        processed += 1;
      }
    }

    return processed;
  }

  private async processEvent(event: {
    id: string;
    eventType: string;
    correlationId: string | null;
    tenantId: string | null;
    payload: Prisma.JsonValue;
  }): Promise<boolean> {
    const tenantCheck = validateOutboxTenantContext(event.tenantId, event.payload);
    if (!tenantCheck.ok) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          message: 'outbox.event.tenant_context_rejected',
          consumer: CONSUMER_NAME,
          eventId: event.id,
          eventType: event.eventType,
          reason: tenantCheck.reason,
          tenantId: event.tenantId,
          correlationId: event.correlationId,
        }),
      );

      await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, status: OutboxEventStatus.PENDING },
        data: {
          status: OutboxEventStatus.FAILED,
          availableAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      return false;
    }

    const already = await this.prisma.processedMessage.findFirst({
      where: { consumerName: CONSUMER_NAME, messageId: event.id },
    });
    if (already !== null) {
      await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, status: OutboxEventStatus.PENDING },
        data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date() },
      });
      return false;
    }

    try {
      await this.dispatch(event.eventType, event.payload);

      return await this.prisma.$transaction(async (tx) => {
        try {
          await tx.processedMessage.create({
            data: {
              consumerName: CONSUMER_NAME,
              messageId: event.id,
              outcome: 'succeeded',
            },
          });
        } catch (error) {
          if (isPrismaUniqueViolation(error)) {
            await tx.outboxEvent.updateMany({
              where: { id: event.id, status: OutboxEventStatus.PENDING },
              data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date() },
            });
            return false;
          }
          throw error;
        }

        await tx.outboxEvent.updateMany({
          where: { id: event.id, status: OutboxEventStatus.PENDING },
          data: {
            status: OutboxEventStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });

        this.logger.log(
          JSON.stringify({
            level: 'info',
            message: 'outbox.event.processed',
            consumer: CONSUMER_NAME,
            eventId: event.id,
            eventType: event.eventType,
            tenantId: event.tenantId,
            correlationId: event.correlationId,
          }),
        );

        return true;
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          message: 'outbox.event.process_failed',
          consumer: CONSUMER_NAME,
          eventId: event.id,
          error: error instanceof Error ? error.message : 'unknown',
        }),
      );

      await this.prisma.outboxEvent.updateMany({
        where: { id: event.id, status: OutboxEventStatus.PENDING },
        data: {
          availableAt: new Date(Date.now() + 15_000),
        },
      });
      return false;
    }
  }

  private async dispatch(eventType: string, payload: Prisma.JsonValue): Promise<void> {
    if (eventType === INVENTORY_IMPORT_COMMIT_EVENT) {
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Invalid inventory.import.commit payload');
      }
      const record = payload as Record<string, unknown>;
      const commitPayload: InventoryImportCommitPayload = {
        tenantId: String(record.tenantId ?? record.organizationId ?? ''),
        organizationId:
          typeof record.organizationId === 'string' ? record.organizationId : undefined,
        importJobId: String(record.importJobId ?? ''),
        actorUserId: String(record.actorUserId ?? ''),
      };
      if (!commitPayload.tenantId || !commitPayload.importJobId) {
        throw new Error('inventory.import.commit payload missing tenantId or importJobId');
      }
      await processInventoryImportCommit(this.prisma, commitPayload);
      return;
    }

    if (eventType === BILLING_RUN_COMMIT_EVENT_TYPE) {
      if (!isBillingRunCommitPayload(payload)) {
        throw new Error('Invalid billing.run.commit payload');
      }
      await processBillingRunCommit(this.prisma, {
        tenantId: String(payload.tenantId),
        billingRunId: String(payload.billingRunId),
      });
      return;
    }

    // Unknown event types are acknowledged (no-op) so the outbox does not stall.
  }
}
