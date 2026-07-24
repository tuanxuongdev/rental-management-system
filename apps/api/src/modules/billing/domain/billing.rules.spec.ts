import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  assertPeriodKey,
  formatCreditNoteNumber,
  formatInvoiceNumber,
  periodBounds,
  priorPeriodKey,
  rentChargeKey,
  roundMoney,
} from './billing.rules';

describe('billing.rules (ADR-0006)', () => {
  it('rounds half-up to 4 decimal places', () => {
    expect(roundMoney(new Prisma.Decimal('1.23455')).toFixed(4)).toBe('1.2346');
    expect(roundMoney(new Prisma.Decimal('1.23454')).toFixed(4)).toBe('1.2345');
    expect(roundMoney(new Prisma.Decimal('10')).toFixed(4)).toBe('10.0000');
  });

  it('parses and validates period keys', () => {
    expect(assertPeriodKey('2026-07')).toEqual({ year: 2026, month: 7 });
    expect(priorPeriodKey('2026-01')).toBe('2025-12');
    expect(priorPeriodKey('2026-07')).toBe('2026-06');
    expect(rentChargeKey('lease-1', '2026-07')).toBe('rent:lease-1:2026-07');
  });

  it('computes UTC period bounds for UTC timezone', () => {
    const { start, end } = periodBounds('2026-02', 'UTC');
    expect(start.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('formats invoice and credit note numbers', () => {
    expect(formatInvoiceNumber(2026, 12)).toBe('INV-2026-000012');
    expect(formatCreditNoteNumber(2026, 3)).toBe('CN-2026-000003');
  });
});
