import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  assertCurrencyMatch,
  invoiceStatusAfterAllocation,
  sumAllocationAmounts,
} from './payment.rules';

describe('payment.rules', () => {
  it('sums allocation amounts as Decimal without float', () => {
    const total = sumAllocationAmounts([{ amount: '10.2500' }, { amount: '5.7500' }]);
    expect(total.toFixed(4)).toBe('16.0000');
  });

  it('derives invoice status from remaining balance', () => {
    expect(invoiceStatusAfterAllocation(new Prisma.Decimal(0))).toBe('PAID');
    expect(invoiceStatusAfterAllocation(new Prisma.Decimal('0.0001'))).toBe('PARTIALLY_PAID');
  });

  it('rejects currency mismatch', () => {
    expect(() => assertCurrencyMatch('USD', 'VND')).toThrow();
    expect(() => assertCurrencyMatch('USD', 'USD')).not.toThrow();
  });

  it('documents unallocated = payment − allocated (seed full amount then subtract)', () => {
    const payment = new Prisma.Decimal('150.0000');
    const allocated = sumAllocationAmounts([{ amount: '100.0000' }]);
    const unallocated = payment.minus(allocated);
    expect(unallocated.toFixed(4)).toBe('50.0000');
  });
});
