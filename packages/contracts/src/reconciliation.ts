import { z } from 'zod';

import { currencyCodeSchema, moneyAmountStringSchema } from './money';
import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const RECONCILIATION_PERMISSION_KEYS = {
  VIEW: PERMISSION_KEYS.FINANCE_RECONCILIATION_VIEW,
  PERFORM: PERMISSION_KEYS.FINANCE_RECONCILIATION_PERFORM,
  APPROVE: PERMISSION_KEYS.FINANCE_RECONCILIATION_APPROVE,
  PERIOD_CLOSE: PERMISSION_KEYS.FINANCE_PERIOD_CLOSE,
  EXPORTS: PERMISSION_KEYS.FINANCE_EXPORTS_CREATE,
  REPORTS_VIEW: PERMISSION_KEYS.FINANCE_REPORTS_VIEW,
  REFUND_APPROVE: PERMISSION_KEYS.FINANCE_REFUNDS_APPROVE,
  REFUND_EXECUTE: PERMISSION_KEYS.FINANCE_REFUNDS_EXECUTE,
  DISPOSITION_APPROVE: PERMISSION_KEYS.FINANCE_DEPOSITS_DISPOSITION_APPROVE,
} as const;

export const DEFAULT_RECONCILIATION_TOLERANCE = '0.0100' as const;

export const ORGANIZATION_RECONCILIATION_RUNS_PATH =
  '/v1/organizations/{organizationId}/reconciliation-runs' as const;
export const ORGANIZATION_RECONCILIATION_RUN_BY_ID_PATH =
  '/v1/organizations/{organizationId}/reconciliation-runs/{runId}' as const;
export const ORGANIZATION_RECONCILIATION_RUN_ITEMS_PATH =
  '/v1/organizations/{organizationId}/reconciliation-runs/{runId}/items' as const;
export const ORGANIZATION_RECONCILIATION_INGEST_PATH =
  '/v1/organizations/{organizationId}/reconciliation-runs/{runId}/ingest-settlements' as const;
export const ORGANIZATION_RECONCILIATION_COMPLETE_PATH =
  '/v1/organizations/{organizationId}/reconciliation-runs/{runId}/complete' as const;
export const ORGANIZATION_RECONCILIATION_ITEM_RESOLVE_PATH =
  '/v1/organizations/{organizationId}/reconciliation-items/{itemId}/resolve' as const;
export const ORGANIZATION_INVOICE_AGING_PATH =
  '/v1/organizations/{organizationId}/invoice-aging' as const;
export const ORGANIZATION_AGING_PATH = '/v1/organizations/{organizationId}/aging' as const;
export const ORGANIZATION_ACCOUNTING_PERIODS_PATH =
  '/v1/organizations/{organizationId}/accounting-periods' as const;
export const ORGANIZATION_ACCOUNTING_PERIOD_CLOSE_PATH =
  '/v1/organizations/{organizationId}/accounting-periods/{periodKey}/close' as const;
export const ORGANIZATION_ACCOUNTING_PERIOD_REOPEN_PATH =
  '/v1/organizations/{organizationId}/accounting-periods/{periodKey}/reopen' as const;
export const ORGANIZATION_BILLING_COMPARISONS_PARALLEL_PATH =
  '/v1/organizations/{organizationId}/billing-comparisons/parallel' as const;
export const ORGANIZATION_EXPORTS_FINANCE_PATH =
  '/v1/organizations/{organizationId}/exports/finance' as const;

export const RECONCILIATION_RUN_COMPLETED_EVENT_TYPE = 'reconciliation.run.completed' as const;
export const PAYMENT_REVERSED_EVENT_TYPE = 'payment.reversed' as const;
export const ACCOUNTING_PERIOD_CLOSED_EVENT_TYPE = 'accounting.period.closed' as const;

export const reconciliationSourceTypeSchema = z.enum(['PROVIDER', 'BANK_FILE', 'CASH_UP']);
export type ReconciliationSourceType = z.infer<typeof reconciliationSourceTypeSchema>;

export const reconciliationRunStatusSchema = z.enum([
  'DRAFT',
  'IN_PROGRESS',
  'PENDING_APPROVAL',
  'COMPLETED',
  'CANCELLED',
]);
export type ReconciliationRunStatus = z.infer<typeof reconciliationRunStatusSchema>;

export const reconciliationItemStatusSchema = z.enum([
  'SUGGESTED',
  'MATCHED',
  'UNMATCHED',
  'EXCEPTION_ACCEPTED',
  'DISPUTED',
  'RESOLVED',
]);
export type ReconciliationItemStatus = z.infer<typeof reconciliationItemStatusSchema>;

export const accountingPeriodStatusSchema = z.enum(['OPEN', 'CLOSED']);
export type AccountingPeriodStatus = z.infer<typeof accountingPeriodStatusSchema>;

export const agingBucketKeySchema = z.enum([
  'CURRENT',
  'DAYS_1_30',
  'DAYS_31_60',
  'DAYS_61_90',
  'DAYS_90_PLUS',
]);
export type AgingBucketKey = z.infer<typeof agingBucketKeySchema>;

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const periodKeySchema = z.string().regex(/^\d{4}-\d{2}$/);

export const createReconciliationRunRequestSchema = z.object({
  sourceType: reconciliationSourceTypeSchema,
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  currency: currencyCodeSchema,
  provider: z.string().min(1).max(100).optional(),
  documentId: z.string().uuid().optional(),
  controlTotal: moneyAmountStringSchema.optional(),
  toleranceAmount: moneyAmountStringSchema.optional(),
});
export type CreateReconciliationRunRequest = z.infer<typeof createReconciliationRunRequestSchema>;

export const settlementIngestLineSchema = z.object({
  externalReference: z.string().min(1).max(200),
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  transactionDate: dateOnlySchema,
});
export type SettlementIngestLine = z.infer<typeof settlementIngestLineSchema>;

export const ingestSettlementsRequestSchema = z.object({
  lines: z.array(settlementIngestLineSchema).min(1).max(500),
});
export type IngestSettlementsRequest = z.infer<typeof ingestSettlementsRequestSchema>;

export const resolveReconciliationItemRequestSchema = z.object({
  resolution: z.enum(['MATCH', 'UNMATCH', 'EXCEPTION_ACCEPTED', 'ADJUSTMENT_REQUIRED']),
  reason: z.string().min(3).max(2000),
  paymentTransactionId: z.string().uuid().optional(),
  resolutionCode: z.string().min(1).max(100).optional(),
});
export type ResolveReconciliationItemRequest = z.infer<
  typeof resolveReconciliationItemRequestSchema
>;

export const completeReconciliationRunRequestSchema = z.object({
  overrideReason: z.string().min(3).max(2000).optional(),
});
export type CompleteReconciliationRunRequest = z.infer<
  typeof completeReconciliationRunRequestSchema
>;

export const refundDecisionRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().min(3).max(2000),
});
export type RefundDecisionRequest = z.infer<typeof refundDecisionRequestSchema>;

export const refundExecuteRequestSchema = z.object({
  executedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});
export type RefundExecuteRequest = z.infer<typeof refundExecuteRequestSchema>;

export const dispositionDecisionRequestSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().min(3).max(2000),
});
export type DispositionDecisionRequest = z.infer<typeof dispositionDecisionRequestSchema>;

export const paymentReverseRequestSchema = z.object({
  reason: z.string().min(3).max(2000),
  effectiveAt: z.string().datetime().optional(),
});
export type PaymentReverseRequest = z.infer<typeof paymentReverseRequestSchema>;

export const closeAccountingPeriodRequestSchema = z.object({
  reason: z.string().max(2000).optional(),
});
export type CloseAccountingPeriodRequest = z.infer<typeof closeAccountingPeriodRequestSchema>;

export const reopenAccountingPeriodRequestSchema = z.object({
  reason: z.string().min(3).max(2000),
});
export type ReopenAccountingPeriodRequest = z.infer<typeof reopenAccountingPeriodRequestSchema>;

export const parallelComparisonSourceTotalSchema = z.object({
  label: z.string().min(1).max(200),
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
});
export type ParallelComparisonSourceTotal = z.infer<typeof parallelComparisonSourceTotalSchema>;

export const parallelBillingComparisonRequestSchema = z.object({
  billingRunId: z.string().uuid(),
  sourceTotals: z.array(parallelComparisonSourceTotalSchema).min(1).max(50),
  toleranceAmount: moneyAmountStringSchema.optional(),
});
export type ParallelBillingComparisonRequest = z.infer<
  typeof parallelBillingComparisonRequestSchema
>;

export const financeExportTypeSchema = z.enum(['aging', 'payments']);
export type FinanceExportType = z.infer<typeof financeExportTypeSchema>;

export const financeExportRequestSchema = z.object({
  type: financeExportTypeSchema,
  asOf: dateOnlySchema.optional(),
  currency: currencyCodeSchema.optional(),
  propertyId: z.string().uuid().optional(),
  format: z.enum(['JSON', 'CSV']).default('JSON'),
});
export type FinanceExportRequest = z.infer<typeof financeExportRequestSchema>;

export const reconciliationRunResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  sourceType: reconciliationSourceTypeSchema,
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  currency: currencyCodeSchema,
  status: reconciliationRunStatusSchema,
  provider: z.string().nullable(),
  documentId: z.string().uuid().nullable(),
  controlTotal: moneyAmountStringSchema.nullable(),
  matchedTotal: moneyAmountStringSchema,
  unmatchedTotal: moneyAmountStringSchema,
  varianceAmount: moneyAmountStringSchema,
  toleranceAmount: moneyAmountStringSchema,
  overrideReason: z.string().nullable(),
  preparedByUserId: z.string().uuid(),
  approvedByUserId: z.string().uuid().nullable(),
  completedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReconciliationRunResponse = z.infer<typeof reconciliationRunResponseSchema>;

export const reconciliationRunsCollectionSchema = createCursorCollectionSchema(
  reconciliationRunResponseSchema,
);
export type ReconciliationRunsCollection = z.infer<typeof reconciliationRunsCollectionSchema>;

export const reconciliationItemResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  runId: z.string().uuid(),
  status: reconciliationItemStatusSchema,
  externalReference: z.string().nullable(),
  externalAmount: moneyAmountStringSchema.nullable(),
  externalDate: dateOnlySchema.nullable(),
  paymentTransactionId: z.string().uuid().nullable(),
  resolutionCode: z.string().nullable(),
  resolutionReason: z.string().nullable(),
  assignedToUserId: z.string().uuid().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReconciliationItemResponse = z.infer<typeof reconciliationItemResponseSchema>;

export const reconciliationItemsCollectionSchema = createCursorCollectionSchema(
  reconciliationItemResponseSchema,
);
export type ReconciliationItemsCollection = z.infer<typeof reconciliationItemsCollectionSchema>;

export const agingAccountSchema = z.object({
  invoiceId: z.string().uuid(),
  leaseId: z.string().uuid(),
  propertyId: z.string().uuid(),
  invoiceNumber: z.string().nullable(),
  currency: currencyCodeSchema,
  balanceAmount: moneyAmountStringSchema,
  dueDate: dateOnlySchema.nullable(),
  daysPastDue: z.number().int().nullable(),
  bucket: agingBucketKeySchema,
  status: z.enum(['POSTED', 'PARTIALLY_PAID']),
});
export type AgingAccount = z.infer<typeof agingAccountSchema>;

export const agingBucketTotalSchema = z.object({
  bucket: agingBucketKeySchema,
  count: z.number().int().nonnegative(),
  amount: moneyAmountStringSchema,
});
export type AgingBucketTotal = z.infer<typeof agingBucketTotalSchema>;

export const invoiceAgingResponseSchema = z.object({
  asOf: dateOnlySchema,
  currency: currencyCodeSchema,
  buckets: z.array(agingBucketTotalSchema),
  accounts: z.array(agingAccountSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    previousCursor: z.string().nullable(),
    limit: z.number().int(),
  }),
  meta: z.record(z.unknown()),
});
export type InvoiceAgingResponse = z.infer<typeof invoiceAgingResponseSchema>;

export const accountingPeriodResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  periodKey: periodKeySchema,
  status: accountingPeriodStatusSchema,
  closedAt: z.string().datetime().nullable(),
  closedByUserId: z.string().uuid().nullable(),
  reopenReason: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AccountingPeriodResponse = z.infer<typeof accountingPeriodResponseSchema>;

export const accountingPeriodsCollectionSchema = createCursorCollectionSchema(
  accountingPeriodResponseSchema,
);
export type AccountingPeriodsCollection = z.infer<typeof accountingPeriodsCollectionSchema>;

export const parallelComparisonVarianceSchema = z.object({
  label: z.string(),
  sourceAmount: moneyAmountStringSchema,
  billingAmount: moneyAmountStringSchema,
  varianceAmount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  withinTolerance: z.boolean(),
});
export type ParallelComparisonVariance = z.infer<typeof parallelComparisonVarianceSchema>;

export const parallelBillingComparisonResponseSchema = z.object({
  billingRunId: z.string().uuid(),
  billingTotal: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  toleranceAmount: moneyAmountStringSchema,
  withinTolerance: z.boolean(),
  variances: z.array(parallelComparisonVarianceSchema),
});
export type ParallelBillingComparisonResponse = z.infer<
  typeof parallelBillingComparisonResponseSchema
>;

export const financeExportResponseSchema = z.object({
  type: financeExportTypeSchema,
  format: z.enum(['JSON', 'CSV']),
  generatedAt: z.string().datetime(),
  rowCount: z.number().int().nonnegative(),
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  csv: z.string().optional(),
});
export type FinanceExportResponse = z.infer<typeof financeExportResponseSchema>;

export const paymentReversalResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  paymentTransactionId: z.string().uuid(),
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  reason: z.string(),
  status: z.enum(['PENDING', 'EXECUTED']),
  requestedByUserId: z.string().uuid(),
  executedByUserId: z.string().uuid().nullable(),
  executedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentReversalResponse = z.infer<typeof paymentReversalResponseSchema>;
