import { describe, expect, it } from 'vitest';

import {
  DEPOSIT_DISPOSITION_EXECUTED_EVENT_TYPE,
  financeDashboardSummarySchema,
  manualPaymentCreateSchema,
  moneyAmountStringSchema,
  ORGANIZATION_ARREARS_PATH,
  ORGANIZATION_FINANCE_DASHBOARD_PATH,
  ORGANIZATION_PAYMENTS_PATH,
  PAYMENT_PERMISSION_KEYS,
  PAYMENT_RECORDED_EVENT_TYPE,
  paymentTransactionResponseSchema,
  PROVIDER_WEBHOOK_PATH,
  RECEIPT_ISSUED_EVENT_TYPE,
} from './index';

describe('@rpm/contracts Sprint-11 payments', () => {
  it('exposes payment paths, events, and permission keys', () => {
    expect(ORGANIZATION_PAYMENTS_PATH).toBe('/v1/organizations/{organizationId}/payments');
    expect(ORGANIZATION_ARREARS_PATH).toBe('/v1/organizations/{organizationId}/arrears');
    expect(ORGANIZATION_FINANCE_DASHBOARD_PATH).toBe(
      '/v1/organizations/{organizationId}/dashboard/finance',
    );
    expect(PROVIDER_WEBHOOK_PATH).toBe('/v1/provider/webhooks/{provider}');
    expect(PAYMENT_RECORDED_EVENT_TYPE).toBe('payment.recorded');
    expect(RECEIPT_ISSUED_EVENT_TYPE).toBe('receipt.issued');
    expect(DEPOSIT_DISPOSITION_EXECUTED_EVENT_TYPE).toBe('deposit.disposition_executed');
    expect(PAYMENT_PERMISSION_KEYS.LIST).toBe('finance.payments.list');
    expect(PAYMENT_PERMISSION_KEYS.RECORD).toBe('finance.payments.record');
    expect(PAYMENT_PERMISSION_KEYS.REFUNDS_REQUEST).toBe('finance.payments.refund');
    expect(PAYMENT_PERMISSION_KEYS.DEPOSITS_DISPOSE).toBe('finance.deposits.disposition.execute');
  });

  it('parses manual payment create with decimal money strings', () => {
    const body = manualPaymentCreateSchema.parse({
      channel: 'CASH',
      amount: '250.5000',
      currency: 'USD',
      receivedAt: '2026-07-24T10:00:00.000Z',
      leaseId: '00000000-0000-4000-8000-000000000001',
      payerPartyId: '00000000-0000-4000-8000-000000000002',
      propertyId: '00000000-0000-4000-8000-000000000003',
      allocations: [
        {
          invoiceId: '00000000-0000-4000-8000-000000000004',
          amount: '250.5000',
        },
      ],
    });
    expect(body.amount).toBe('250.5000');
    expect(body.allocations).toHaveLength(1);
    expect(() => moneyAmountStringSchema.parse(99.5)).toThrow();
  });

  it('validates payment transaction and finance dashboard money fields', () => {
    const payment = paymentTransactionResponseSchema.parse({
      id: '00000000-0000-4000-8000-000000000010',
      organizationId: '00000000-0000-4000-8000-000000000011',
      intentId: null,
      leaseId: '00000000-0000-4000-8000-000000000012',
      propertyId: '00000000-0000-4000-8000-000000000013',
      payerPartyId: '00000000-0000-4000-8000-000000000014',
      amount: '100.0000',
      unallocatedAmount: '0.0000',
      currency: 'USD',
      channel: 'CASH',
      status: 'SETTLED',
      externalReference: null,
      provider: null,
      providerPaymentId: null,
      receivedAt: '2026-07-24T10:00:00.000Z',
      accountingAt: '2026-07-24T10:00:00.000Z',
      notes: null,
      evidenceDocumentId: null,
      receiptId: null,
      version: 1,
      createdAt: '2026-07-24T10:00:00.000Z',
      updatedAt: '2026-07-24T10:00:00.000Z',
    });
    expect(payment.amount).toBe('100.0000');

    const dashboard = financeDashboardSummarySchema.parse({
      organizationId: '00000000-0000-4000-8000-000000000011',
      asOf: '2026-07-24T12:00:00.000Z',
      outstandingTotal: '500.0000',
      unpaidInvoiceCount: 2,
      collectedThisPeriod: '100.0000',
      depositsHeldTotal: '1000.0000',
      currency: 'USD',
      recentPayments: [payment],
      financeNote: 'Staff-only collection path (Sprint-11).',
    });
    expect(dashboard.unpaidInvoiceCount).toBe(2);
  });
});
