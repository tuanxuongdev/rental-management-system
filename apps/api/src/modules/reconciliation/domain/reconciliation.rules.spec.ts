import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  assertActorsDistinct,
  assertVarianceWithinTolerance,
  classifyAgingBucket,
  DEFAULT_RECONCILIATION_TOLERANCE,
} from './reconciliation.rules';

describe('reconciliation.rules', () => {
  it('classifies aging buckets by dueDate vs asOf', () => {
    const asOf = new Date(Date.UTC(2026, 6, 24));
    expect(classifyAgingBucket(new Date(Date.UTC(2026, 6, 30)), asOf).bucket).toBe('CURRENT');
    expect(classifyAgingBucket(new Date(Date.UTC(2026, 6, 10)), asOf).bucket).toBe('DAYS_1_30');
    expect(classifyAgingBucket(new Date(Date.UTC(2026, 5, 10)), asOf).bucket).toBe('DAYS_31_60');
    expect(classifyAgingBucket(new Date(Date.UTC(2026, 4, 10)), asOf).bucket).toBe('DAYS_61_90');
    expect(classifyAgingBucket(new Date(Date.UTC(2026, 0, 1)), asOf).bucket).toBe('DAYS_90_PLUS');
  });

  it('enforces SoD by userId identity', () => {
    expect(() =>
      assertActorsDistinct([
        { role: 'requester', userId: 'u1' },
        { role: 'approver', userId: 'u1' },
      ]),
    ).toThrow(ForbiddenException);

    expect(() =>
      assertActorsDistinct([
        { role: 'requester', userId: 'u1' },
        { role: 'approver', userId: 'u2' },
        { role: 'executor', userId: 'u3' },
      ]),
    ).not.toThrow();
  });

  it('rejects force-complete over tolerance without override + approve', () => {
    expect(() =>
      assertVarianceWithinTolerance({
        varianceAmount: new Prisma.Decimal('1.0000'),
        toleranceAmount: DEFAULT_RECONCILIATION_TOLERANCE,
        hasApprovePermission: false,
      }),
    ).toThrow(UnprocessableEntityException);

    expect(() =>
      assertVarianceWithinTolerance({
        varianceAmount: new Prisma.Decimal('1.0000'),
        toleranceAmount: DEFAULT_RECONCILIATION_TOLERANCE,
        hasApprovePermission: true,
        overrideReason: 'Bank fee explained',
      }),
    ).not.toThrow();
  });
});
