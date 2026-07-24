import { describe, expect, it } from 'vitest';

import {
  BILLING_RUN_COMMIT_EVENT_TYPE,
  billingRunPreviewRequestSchema,
  FINANCE_PERMISSION_KEYS,
  invoiceResponseSchema,
  moneyAmountStringSchema,
  ORGANIZATION_BILLING_RUN_PREVIEW_PATH,
  ORGANIZATION_BILLING_RUNS_PATH,
  UTILITIES_ALLOCATION_ENABLED,
  utilityAllocationPreviewRequestSchema,
} from './index';

describe('@rpm/contracts Sprint-10 billing', () => {
  it('exposes billing paths, event types, and finance permission keys', () => {
    expect(ORGANIZATION_BILLING_RUNS_PATH).toBe('/v1/organizations/{organizationId}/billing-runs');
    expect(ORGANIZATION_BILLING_RUN_PREVIEW_PATH).toBe(
      '/v1/organizations/{organizationId}/billing-runs/{billingRunId}/preview',
    );
    expect(BILLING_RUN_COMMIT_EVENT_TYPE).toBe('billing.run.commit');
    expect(FINANCE_PERMISSION_KEYS.BILLING_RUN_COMMIT).toBe('finance.billing_run.commit');
    expect(UTILITIES_ALLOCATION_ENABLED).toBe(true);
  });

  it('parses billing run preview and utility allocation preview requests', () => {
    const preview = billingRunPreviewRequestSchema.parse({
      refresh: true,
      sampleLimit: 25,
    });
    expect(preview.sampleLimit).toBe(25);

    const utilityPreview = utilityAllocationPreviewRequestSchema.parse({
      propertyId: '00000000-0000-4000-8000-000000000001',
      utilityType: 'WATER',
      servicePeriod: '2026-07',
      method: 'EQUAL_SHARE',
      tariffId: '00000000-0000-4000-8000-000000000002',
    });
    expect(utilityPreview.method).toBe('EQUAL_SHARE');
  });

  it('validates invoice response money fields as decimal strings and rejects floats', () => {
    const invoice = invoiceResponseSchema.parse({
      id: '00000000-0000-4000-8000-000000000010',
      organizationId: '00000000-0000-4000-8000-000000000011',
      leaseId: '00000000-0000-4000-8000-000000000012',
      propertyId: '00000000-0000-4000-8000-000000000013',
      billingRunId: null,
      billToPartyId: '00000000-0000-4000-8000-000000000014',
      invoiceNumber: 'INV-2026-0001',
      status: 'POSTED',
      currency: 'USD',
      issueDate: '2026-07-01',
      dueDate: '2026-07-15',
      periodKey: '2026-07',
      subtotalAmount: '1000.0000',
      taxAmount: '0.0000',
      totalAmount: '1000.0000',
      balanceAmount: '1000.0000',
      version: 2,
      postedAt: '2026-07-01T12:00:00.000Z',
      voidedAt: null,
      createdAt: '2026-07-01T10:00:00.000Z',
      updatedAt: '2026-07-01T12:00:00.000Z',
    });
    expect(invoice.totalAmount).toBe('1000.0000');

    expect(() => moneyAmountStringSchema.parse(1200.5)).toThrow();
    expect(() =>
      invoiceResponseSchema.parse({
        ...invoice,
        totalAmount: 1000,
      }),
    ).toThrow();
  });
});
