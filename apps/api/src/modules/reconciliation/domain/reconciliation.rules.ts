import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { AgingBucketKey } from '@rpm/contracts';

import { roundMoney } from '../../billing/domain/billing.rules';

export const DEFAULT_RECONCILIATION_TOLERANCE = new Prisma.Decimal('0.0100');

/** Date-only YYYY-MM-DD → aging bucket vs asOf (also date-only). */
export function classifyAgingBucket(
  dueDate: Date | null,
  asOf: Date,
): { bucket: AgingBucketKey; daysPastDue: number | null } {
  if (dueDate === null) {
    return { bucket: 'CURRENT', daysPastDue: null };
  }
  const dueMs = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const asOfMs = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
  const daysPastDue = Math.floor((asOfMs - dueMs) / (24 * 60 * 60 * 1000));
  if (daysPastDue <= 0) {
    return { bucket: 'CURRENT', daysPastDue: daysPastDue < 0 ? daysPastDue : 0 };
  }
  if (daysPastDue <= 30) {
    return { bucket: 'DAYS_1_30', daysPastDue };
  }
  if (daysPastDue <= 60) {
    return { bucket: 'DAYS_31_60', daysPastDue };
  }
  if (daysPastDue <= 90) {
    return { bucket: 'DAYS_61_90', daysPastDue };
  }
  return { bucket: 'DAYS_90_PLUS', daysPastDue };
}

export function assertActorsDistinct(
  actors: Array<{ role: string; userId: string | null | undefined }>,
): void {
  const seen = new Map<string, string>();
  for (const actor of actors) {
    if (actor.userId === null || actor.userId === undefined || actor.userId === '') {
      continue;
    }
    const prior = seen.get(actor.userId);
    if (prior !== undefined) {
      throw new ForbiddenException({
        message: `Separation of duties violated: same user cannot act as ${prior} and ${actor.role}`,
        code: 'SEPARATION_OF_DUTIES_VIOLATION',
      });
    }
    seen.set(actor.userId, actor.role);
  }
}

export function assertVarianceWithinTolerance(input: {
  varianceAmount: Prisma.Decimal;
  toleranceAmount: Prisma.Decimal;
  overrideReason?: string | null;
  hasApprovePermission: boolean;
}): void {
  const absVariance = roundMoney(input.varianceAmount.abs());
  const tolerance = roundMoney(input.toleranceAmount);
  if (absVariance.lte(tolerance)) {
    return;
  }
  if (
    input.hasApprovePermission &&
    input.overrideReason !== undefined &&
    input.overrideReason !== null &&
    input.overrideReason.trim().length >= 3
  ) {
    return;
  }
  throw new UnprocessableEntityException({
    message: 'Reconciliation variance exceeds tolerance without approved override',
    code: 'RECONCILIATION_VARIANCE_EXCEEDED',
  });
}

export function computePeriodKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function amountsMatch(
  a: Prisma.Decimal,
  b: Prisma.Decimal,
  tolerance: Prisma.Decimal = DEFAULT_RECONCILIATION_TOLERANCE,
): boolean {
  return roundMoney(a.minus(b).abs()).lte(roundMoney(tolerance));
}
