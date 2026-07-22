import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { OutboxEventStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../infrastructure/prisma/prisma.module';

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
  }): Promise<boolean> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const current = await tx.outboxEvent.findFirst({
          where: {
            id: event.id,
            status: OutboxEventStatus.PENDING,
          },
        });

        if (current === null) {
          return false;
        }

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
              where: {
                id: event.id,
                status: OutboxEventStatus.PENDING,
              },
              data: {
                status: OutboxEventStatus.PUBLISHED,
                publishedAt: new Date(),
              },
            });
            return false;
          }

          throw error;
        }

        await tx.outboxEvent.update({
          where: { id: event.id },
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
      return false;
    }
  }
}
