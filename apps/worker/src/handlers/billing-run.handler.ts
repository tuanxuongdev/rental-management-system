import { type Prisma, type PrismaClient } from '@prisma/client';

import { BILLING_RUN_COMMIT_EVENT_TYPE } from '@rpm/contracts';

import { billingAdvisoryLockKey } from './billing-run.commit';

export type BillingRunCommitPayload = {
  tenantId: string;
  billingRunId: string;
};

/**
 * Idempotent worker handler: no-op when the run is already COMPLETED.
 * Otherwise re-acquires the advisory lock and leaves status unchanged if already finished,
 * or marks FAILED runs for API retry (does not invent a second commit path).
 */
export async function processBillingRunCommit(
  prisma: PrismaClient,
  payload: BillingRunCommitPayload,
): Promise<{ status: string }> {
  const tenantId = payload.tenantId;
  const run = await prisma.billingRun.findFirst({
    where: { id: payload.billingRunId, tenantId },
  });

  if (run === null) {
    return { status: 'MISSING' };
  }

  if (run.status === 'COMPLETED') {
    return { status: run.status };
  }

  // Sync API commit is authoritative; worker acknowledges in-flight/failed for visibility.
  if (run.status === 'COMMITTING') {
    return { status: run.status };
  }

  if (run.status === 'FAILED' || run.status === 'PARTIAL') {
    // Leave for API retry; still take lock briefly to serialize with concurrent workers.
    await prisma.$transaction(async (tx) => {
      const lockKey = billingAdvisoryLockKey(tenantId, run.periodKey);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    });
    return { status: run.status };
  }

  return { status: run.status };
}

export { BILLING_RUN_COMMIT_EVENT_TYPE };

export function isBillingRunCommitPayload(
  payload: Prisma.JsonValue,
): payload is Prisma.JsonObject & BillingRunCommitPayload {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return typeof record.tenantId === 'string' && typeof record.billingRunId === 'string';
}
