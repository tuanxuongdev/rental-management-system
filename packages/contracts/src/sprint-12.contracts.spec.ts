import { describe, expect, it } from 'vitest';

import {
  createReconciliationRunRequestSchema,
  DEFAULT_RECONCILIATION_TOLERANCE,
  financeExportRequestSchema,
  invoiceAgingResponseSchema,
  moneyAmountStringSchema,
  ORGANIZATION_AGING_PATH,
  ORGANIZATION_EXPORTS_FINANCE_PATH,
  ORGANIZATION_INVOICE_AGING_PATH,
  ORGANIZATION_RECONCILIATION_RUNS_PATH,
  parallelBillingComparisonRequestSchema,
  PERMISSION_KEYS,
  RECONCILIATION_PERMISSION_KEYS,
  RECONCILIATION_RUN_COMPLETED_EVENT_TYPE,
} from './index';

describe('@rpm/contracts Sprint-12 reconciliation', () => {
  it('exposes recon paths, events, and permission keys from docs/06', () => {
    expect(ORGANIZATION_RECONCILIATION_RUNS_PATH).toBe(
      '/v1/organizations/{organizationId}/reconciliation-runs',
    );
    expect(ORGANIZATION_INVOICE_AGING_PATH).toBe(
      '/v1/organizations/{organizationId}/invoice-aging',
    );
    expect(ORGANIZATION_AGING_PATH).toBe('/v1/organizations/{organizationId}/aging');
    expect(ORGANIZATION_EXPORTS_FINANCE_PATH).toBe(
      '/v1/organizations/{organizationId}/exports/finance',
    );
    expect(RECONCILIATION_RUN_COMPLETED_EVENT_TYPE).toBe('reconciliation.run.completed');
    expect(RECONCILIATION_PERMISSION_KEYS.VIEW).toBe('finance.reconciliation.view');
    expect(RECONCILIATION_PERMISSION_KEYS.PERFORM).toBe('finance.reconciliation.perform');
    expect(RECONCILIATION_PERMISSION_KEYS.APPROVE).toBe('finance.reconciliation.approve');
    expect(RECONCILIATION_PERMISSION_KEYS.PERIOD_CLOSE).toBe('finance.period.close');
    expect(RECONCILIATION_PERMISSION_KEYS.EXPORTS).toBe('finance.exports.create');
    expect(PERMISSION_KEYS.FINANCE_REFUNDS_APPROVE).toBe('finance.payments.refund.approve');
    expect(PERMISSION_KEYS.FINANCE_DEPOSITS_DISPOSITION_APPROVE).toBe(
      'finance.deposits.disposition.approve',
    );
    expect(DEFAULT_RECONCILIATION_TOLERANCE).toBe('0.0100');
  });

  it('parses create run and parallel comparison with decimal money strings', () => {
    const run = createReconciliationRunRequestSchema.parse({
      sourceType: 'PROVIDER',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      currency: 'USD',
      controlTotal: '1000.0000',
      toleranceAmount: '0.0100',
    });
    expect(run.currency).toBe('USD');
    expect(() => moneyAmountStringSchema.parse(10)).toThrow();

    const comparison = parallelBillingComparisonRequestSchema.parse({
      billingRunId: '00000000-0000-4000-8000-000000000001',
      sourceTotals: [{ label: 'source-a', amount: '500.0000', currency: 'USD' }],
    });
    expect(comparison.sourceTotals).toHaveLength(1);
  });

  it('validates aging and export payloads', () => {
    const aging = invoiceAgingResponseSchema.parse({
      asOf: '2026-07-24',
      currency: 'USD',
      buckets: [
        { bucket: 'CURRENT', count: 1, amount: '100.0000' },
        { bucket: 'DAYS_1_30', count: 0, amount: '0.0000' },
        { bucket: 'DAYS_31_60', count: 0, amount: '0.0000' },
        { bucket: 'DAYS_61_90', count: 0, amount: '0.0000' },
        { bucket: 'DAYS_90_PLUS', count: 1, amount: '50.0000' },
      ],
      accounts: [
        {
          invoiceId: '00000000-0000-4000-8000-000000000010',
          leaseId: '00000000-0000-4000-8000-000000000011',
          propertyId: '00000000-0000-4000-8000-000000000012',
          invoiceNumber: 'INV-1',
          currency: 'USD',
          balanceAmount: '50.0000',
          dueDate: '2026-01-01',
          daysPastDue: 204,
          bucket: 'DAYS_90_PLUS',
          status: 'POSTED',
        },
      ],
      page: { nextCursor: null, previousCursor: null, limit: 25 },
      meta: {},
    });
    expect(aging.buckets).toHaveLength(5);

    const exportReq = financeExportRequestSchema.parse({
      type: 'aging',
      asOf: '2026-07-24',
      currency: 'USD',
      format: 'CSV',
    });
    expect(exportReq.type).toBe('aging');
  });
});
