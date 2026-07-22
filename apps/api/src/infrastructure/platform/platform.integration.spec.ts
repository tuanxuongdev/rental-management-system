import { randomUUID } from 'node:crypto';

import { ConflictException } from '@nestjs/common';
import { OutboxEventStatus } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { IdempotencyService } from '../idempotency/idempotency.service';
import { OutboxService } from '../outbox/outbox.service';
import { TransactionService } from '../persistence/transaction.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Platform durability integration (Sprint-02)', () => {
  const prisma = createIntegrationPrismaClient();
  const outbox = new OutboxService(prisma as never);
  const transactions = new TransactionService(prisma as never);
  const idempotency = new IdempotencyService(prisma as never);

  beforeAll(async () => {
    await resetPlatformTables(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('T02-01: platform tables exist after migration', async () => {
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    const names = tables.map((row) => row.tablename);
    expect(names).toEqual(
      expect.arrayContaining([
        'outbox_events',
        'processed_messages',
        'scheduled_jobs',
        'idempotency_keys',
      ]),
    );
  });

  it('T02-04/T02-05: outbox event is processed exactly once', async () => {
    await resetPlatformTables(prisma);

    const eventId = await transactions.run(async (tx) => {
      const created = await outbox.appendInTransaction(tx, {
        aggregateType: 'platform.sample',
        aggregateId: randomUUID(),
        eventType: 'platform.sample.created',
        payload: { sample: true },
      });
      return created.id;
    });

    const consumer = 'rpm.worker.outbox';

    const processOnce = async (): Promise<boolean> =>
      prisma.$transaction(async (tx) => {
        const current = await tx.outboxEvent.findFirst({
          where: { id: eventId, status: OutboxEventStatus.PENDING },
        });
        if (current === null) {
          return false;
        }

        await tx.processedMessage.create({
          data: { consumerName: consumer, messageId: eventId, outcome: 'succeeded' },
        });

        await tx.outboxEvent.update({
          where: { id: eventId },
          data: { status: OutboxEventStatus.PUBLISHED, publishedAt: new Date() },
        });

        return true;
      });

    expect(await processOnce()).toBe(true);
    expect(await processOnce()).toBe(false);

    await expect(
      prisma.processedMessage.create({
        data: { consumerName: consumer, messageId: eventId, outcome: 'succeeded' },
      }),
    ).rejects.toThrow();

    const pending = await prisma.outboxEvent.count({
      where: { status: OutboxEventStatus.PENDING },
    });
    expect(pending).toBe(0);
  });

  it('T02-07/T02-08: idempotency replay and body mismatch conflict', async () => {
    await resetPlatformTables(prisma);

    const key = `idem-${randomUUID()}`;
    const operation = 'POST /v1/meta/idempotent-echo';
    const actorScope = 'platform';
    const requestHash = idempotency.hashRequest('POST', '/v1/meta/idempotent-echo', {
      message: 'hello',
    });

    const first = await transactions.run((tx) =>
      idempotency.resolveOrCreate(tx, {
        tenantId: null,
        actorScope,
        operation,
        key,
        requestHash,
        responseStatus: 200,
        responseBody: { message: 'hello', echoId: 'echo-1' },
      }),
    );
    expect(first.replayed).toBe(false);

    const replay = await transactions.run((tx) =>
      idempotency.resolveOrCreate(tx, {
        tenantId: null,
        actorScope,
        operation,
        key,
        requestHash,
        responseStatus: 200,
        responseBody: { message: 'hello', echoId: 'echo-1' },
      }),
    );
    expect(replay.replayed).toBe(true);

    await expect(
      transactions.run((tx) =>
        idempotency.resolveOrCreate(tx, {
          tenantId: null,
          actorScope,
          operation,
          key,
          requestHash: idempotency.hashRequest('POST', '/v1/meta/idempotent-echo', {
            message: 'changed',
          }),
          responseStatus: 200,
          responseBody: { message: 'changed', echoId: 'echo-2' },
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T02-07 race: concurrent idempotency create resolves to single write + replay', async () => {
    await resetPlatformTables(prisma);

    const key = `idem-race-${randomUUID()}`;
    const operation = 'POST /v1/meta/idempotent-echo';
    const actorScope = 'platform';
    const requestHash = idempotency.hashRequest('POST', '/v1/meta/idempotent-echo', {
      message: 'race',
    });
    const input = {
      tenantId: null,
      actorScope,
      operation,
      key,
      requestHash,
      responseStatus: 200,
      responseBody: { message: 'race', echoId: 'echo-race' },
    };

    const [first, second] = await Promise.all([
      transactions.run((tx) => idempotency.resolveOrCreate(tx, input)),
      transactions.run((tx) => idempotency.resolveOrCreate(tx, input)),
    ]);

    const replayCount = [first, second].filter((result) => result.replayed).length;
    const freshCount = [first, second].filter((result) => !result.replayed).length;
    expect(freshCount).toBe(1);
    expect(replayCount).toBe(1);

    const stored = await prisma.idempotencyKey.count({
      where: { key, operation, actorScope },
    });
    expect(stored).toBe(1);
  });
});
