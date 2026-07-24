import { z } from 'zod';

import { currencyCodeSchema, moneyAmountStringSchema } from './money';
import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const FINANCE_PERMISSION_KEYS = {
  CHARGES_CREATE: PERMISSION_KEYS.FINANCE_CHARGES_CREATE,
  CHARGES_UPDATE: PERMISSION_KEYS.FINANCE_CHARGES_UPDATE,
  CHARGES_VOID: PERMISSION_KEYS.FINANCE_CHARGES_VOID,
  INVOICES_LIST: PERMISSION_KEYS.FINANCE_INVOICES_LIST,
  INVOICES_VIEW: PERMISSION_KEYS.FINANCE_INVOICES_VIEW,
  INVOICES_ISSUE: PERMISSION_KEYS.FINANCE_INVOICES_ISSUE,
  BILLING_RUN_PREVIEW: PERMISSION_KEYS.FINANCE_BILLING_RUN_PREVIEW,
  BILLING_RUN_COMMIT: PERMISSION_KEYS.FINANCE_BILLING_RUN_COMMIT,
  DEPOSITS_VIEW: PERMISSION_KEYS.FINANCE_DEPOSITS_VIEW,
  DEPOSITS_RECORD: PERMISSION_KEYS.FINANCE_DEPOSITS_RECORD,
  CREDIT_NOTES_CREATE: PERMISSION_KEYS.FINANCE_CREDIT_NOTES_CREATE,
  CREDIT_NOTES_POST: PERMISSION_KEYS.FINANCE_CREDIT_NOTES_POST,
  REPORTS_VIEW: PERMISSION_KEYS.FINANCE_REPORTS_VIEW,
} as const;

export const METERS_PERMISSION_KEYS = {
  LIST: PERMISSION_KEYS.METERS_LIST,
  VIEW: PERMISSION_KEYS.METERS_VIEW,
  CREATE: PERMISSION_KEYS.METERS_CREATE,
  UPDATE: PERMISSION_KEYS.METERS_UPDATE,
  READINGS_RECORD: PERMISSION_KEYS.METERS_READINGS_RECORD,
  READINGS_BULK: PERMISSION_KEYS.METERS_READINGS_BULK,
} as const;

export const ORGANIZATION_BILLING_RUNS_PATH =
  '/v1/organizations/{organizationId}/billing-runs' as const;
export const ORGANIZATION_BILLING_RUN_BY_ID_PATH =
  '/v1/organizations/{organizationId}/billing-runs/{billingRunId}' as const;
export const ORGANIZATION_BILLING_RUN_PREVIEW_PATH =
  '/v1/organizations/{organizationId}/billing-runs/{billingRunId}/preview' as const;
export const ORGANIZATION_BILLING_RUN_APPROVE_PATH =
  '/v1/organizations/{organizationId}/billing-runs/{billingRunId}/approve' as const;
export const ORGANIZATION_BILLING_RUN_COMMIT_PATH =
  '/v1/organizations/{organizationId}/billing-runs/{billingRunId}/commit' as const;
export const ORGANIZATION_BILLING_RUN_RETRY_PATH =
  '/v1/organizations/{organizationId}/billing-runs/{billingRunId}/retry' as const;

export const ORGANIZATION_INVOICES_PATH = '/v1/organizations/{organizationId}/invoices' as const;
export const ORGANIZATION_INVOICE_BY_ID_PATH =
  '/v1/organizations/{organizationId}/invoices/{invoiceId}' as const;
export const ORGANIZATION_INVOICE_POST_PATH =
  '/v1/organizations/{organizationId}/invoices/{invoiceId}/post' as const;
export const ORGANIZATION_INVOICE_VOID_PATH =
  '/v1/organizations/{organizationId}/invoices/{invoiceId}/void' as const;

export const ORGANIZATION_CREDIT_NOTES_PATH =
  '/v1/organizations/{organizationId}/credit-notes' as const;
export const ORGANIZATION_CREDIT_NOTE_POST_PATH =
  '/v1/organizations/{organizationId}/credit-notes/{creditNoteId}/post' as const;

export const ORGANIZATION_DEPOSITS_PATH = '/v1/organizations/{organizationId}/deposits' as const;
export const ORGANIZATION_DEPOSIT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/deposits/{depositId}' as const;

export const ORGANIZATION_LEDGER_ENTRIES_PATH =
  '/v1/organizations/{organizationId}/ledger-entries' as const;

export const ORGANIZATION_METERS_PATH = '/v1/organizations/{organizationId}/meters' as const;
export const ORGANIZATION_METER_BY_ID_PATH =
  '/v1/organizations/{organizationId}/meters/{meterId}' as const;
export const ORGANIZATION_METER_READINGS_BULK_PATH =
  '/v1/organizations/{organizationId}/meter-readings/bulk' as const;

export const ORGANIZATION_UTILITY_ALLOCATION_RUNS_PATH =
  '/v1/organizations/{organizationId}/utility-allocation-runs' as const;
export const ORGANIZATION_UTILITY_ALLOCATION_RUN_BY_ID_PATH =
  '/v1/organizations/{organizationId}/utility-allocation-runs/{runId}' as const;
export const ORGANIZATION_UTILITY_ALLOCATION_RUN_PREVIEW_PATH =
  '/v1/organizations/{organizationId}/utility-allocation-runs/preview' as const;
export const ORGANIZATION_UTILITY_ALLOCATION_RUN_COMMIT_PATH =
  '/v1/organizations/{organizationId}/utility-allocation-runs/{runId}/commit' as const;

export const ORGANIZATION_BALANCES_PATH = '/v1/organizations/{organizationId}/balances' as const;

export const BILLING_RUN_COMMIT_EVENT_TYPE = 'billing.run.commit' as const;
export const INVOICE_POSTED_EVENT_TYPE = 'invoice.posted' as const;
export const DEPOSIT_RECORDED_EVENT_TYPE = 'deposit.recorded' as const;

/**
 * MVP product flag: utility allocation UI/API may be gated while rent billing ships first (Sprint-10).
 */
export const UTILITIES_ALLOCATION_ENABLED = true as const;

export const invoiceStatusSchema = z.enum(['DRAFT', 'POSTED', 'VOID', 'PARTIALLY_PAID', 'PAID']);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

/** Aligns with Prisma `BillingRunStatus`. */
export const billingRunStatusSchema = z.enum([
  'DRAFT',
  'PREVIEWED',
  'APPROVED',
  'COMMITTING',
  'COMPLETED',
  'FAILED',
  'PARTIAL',
]);
export type BillingRunStatus = z.infer<typeof billingRunStatusSchema>;

export const creditNoteStatusSchema = z.enum(['DRAFT', 'POSTED', 'VOID']);
export type CreditNoteStatus = z.infer<typeof creditNoteStatusSchema>;

export const securityDepositStatusSchema = z.enum(['DUE', 'HELD', 'PARTIALLY_DISPOSED', 'CLOSED']);
export type SecurityDepositStatus = z.infer<typeof securityDepositStatusSchema>;

export const meterTypeSchema = z.enum(['ELECTRICITY', 'WATER']);
export type MeterType = z.infer<typeof meterTypeSchema>;

export const meterStatusSchema = z.enum(['ACTIVE', 'RETIRED']);
export type MeterStatus = z.infer<typeof meterStatusSchema>;

export const meterReadingQualitySchema = z.enum(['ACTUAL', 'ESTIMATE', 'CORRECTED']);
export type MeterReadingQuality = z.infer<typeof meterReadingQualitySchema>;

export const utilityAllocationRunStatusSchema = z.enum([
  'DRAFT',
  'PREVIEWED',
  'COMMITTED',
  'FAILED',
]);
export type UtilityAllocationRunStatus = z.infer<typeof utilityAllocationRunStatusSchema>;

export const utilityAllocationMethodSchema = z.enum([
  'EQUAL_SHARE',
  'OCCUPANCY_DAYS',
  'FLOOR_AREA',
  'SUBMETER_DIFFERENCE',
  'WEIGHTED',
]);
export type UtilityAllocationMethod = z.infer<typeof utilityAllocationMethodSchema>;

export const ledgerEntrySideSchema = z.enum(['DEBIT', 'CREDIT']);
export type LedgerEntrySide = z.infer<typeof ledgerEntrySideSchema>;

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const periodKeySchema = z.string().min(1).max(32);

export const createBillingRunRequestSchema = z.object({
  scheduleId: z.string().uuid().optional(),
  propertyId: z.string().uuid().optional(),
  periodKey: periodKeySchema,
  timeZone: z.string().min(1).max(64),
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  currency: currencyCodeSchema.optional(),
});
export type CreateBillingRunRequest = z.infer<typeof createBillingRunRequestSchema>;

export const billingRunPreviewRequestSchema = z.object({
  refresh: z.boolean().optional(),
  sampleLimit: z.number().int().positive().max(100).optional(),
});
export type BillingRunPreviewRequest = z.infer<typeof billingRunPreviewRequestSchema>;

export const approveBillingRunRequestSchema = z.object({
  approvalEvidence: z.record(z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
});
export type ApproveBillingRunRequest = z.infer<typeof approveBillingRunRequestSchema>;

export const commitBillingRunRequestSchema = z.object({
  approvalEvidence: z.record(z.unknown()).optional(),
});
export type CommitBillingRunRequest = z.infer<typeof commitBillingRunRequestSchema>;

export const retryBillingRunRequestSchema = z.object({
  retryFailedOnly: z.boolean().default(true),
});
export type RetryBillingRunRequest = z.infer<typeof retryBillingRunRequestSchema>;

export const billingRunPreviewLineSchema = z.object({
  leaseId: z.string().uuid(),
  leaseNumber: z.string().nullable(),
  propertyId: z.string().uuid(),
  currency: currencyCodeSchema,
  amount: moneyAmountStringSchema,
  chargeKey: z.string().min(1).max(128),
  description: z.string().min(1).max(500),
});
export type BillingRunPreviewLine = z.infer<typeof billingRunPreviewLineSchema>;

export const billingRunPreviewResponseSchema = z.object({
  billingRunId: z.string().uuid(),
  status: billingRunStatusSchema,
  periodKey: periodKeySchema,
  currency: currencyCodeSchema.nullable(),
  totalsAmount: moneyAmountStringSchema.nullable(),
  priorPeriodTotalsAmount: moneyAmountStringSchema.nullable(),
  lineCount: z.number().int().nonnegative(),
  sampleLines: z.array(billingRunPreviewLineSchema).max(100),
  generatedAt: z.string().datetime(),
});
export type BillingRunPreviewResponse = z.infer<typeof billingRunPreviewResponseSchema>;

export const billingRunResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  scheduleId: z.string().uuid().nullable(),
  propertyId: z.string().uuid().nullable(),
  periodKey: periodKeySchema,
  status: billingRunStatusSchema,
  timeZone: z.string(),
  periodStart: dateOnlySchema,
  periodEnd: dateOnlySchema,
  currency: currencyCodeSchema.nullable(),
  totalsAmount: moneyAmountStringSchema.nullable(),
  scheduledJobId: z.string().nullable(),
  approvedAt: z.string().datetime().nullable(),
  committedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BillingRunResponse = z.infer<typeof billingRunResponseSchema>;

export const billingRunsCollectionSchema = createCursorCollectionSchema(billingRunResponseSchema);
export type BillingRunsCollection = z.infer<typeof billingRunsCollectionSchema>;

export const invoiceLineResponseSchema = z.object({
  id: z.string().uuid(),
  lineNumber: z.number().int(),
  description: z.string(),
  quantity: moneyAmountStringSchema,
  unitAmount: moneyAmountStringSchema,
  lineAmount: moneyAmountStringSchema,
  taxAmount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  servicePeriodStart: dateOnlySchema.nullable(),
  servicePeriodEnd: dateOnlySchema.nullable(),
});
export type InvoiceLineResponse = z.infer<typeof invoiceLineResponseSchema>;

export const invoiceResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  leaseId: z.string().uuid(),
  propertyId: z.string().uuid(),
  billingRunId: z.string().uuid().nullable(),
  billToPartyId: z.string().uuid(),
  invoiceNumber: z.string().nullable(),
  status: invoiceStatusSchema,
  currency: currencyCodeSchema,
  issueDate: dateOnlySchema.nullable(),
  dueDate: dateOnlySchema.nullable(),
  periodKey: z.string().nullable(),
  subtotalAmount: moneyAmountStringSchema,
  taxAmount: moneyAmountStringSchema,
  totalAmount: moneyAmountStringSchema,
  balanceAmount: moneyAmountStringSchema,
  version: z.number().int(),
  postedAt: z.string().datetime().nullable(),
  voidedAt: z.string().datetime().nullable(),
  lines: z.array(invoiceLineResponseSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type InvoiceResponse = z.infer<typeof invoiceResponseSchema>;

export const invoicesCollectionSchema = createCursorCollectionSchema(invoiceResponseSchema);
export type InvoicesCollection = z.infer<typeof invoicesCollectionSchema>;

export const postInvoiceRequestSchema = z.object({
  postedAt: z.string().datetime(),
  approvalEvidence: z.record(z.unknown()).optional(),
  sendAfterPost: z.boolean().optional(),
});
export type PostInvoiceRequest = z.infer<typeof postInvoiceRequestSchema>;

export const voidInvoiceRequestSchema = z.object({
  reason: z.string().min(3).max(2000),
  effectiveAt: z.string().datetime(),
  replacementInvoiceId: z.string().uuid().optional(),
  approvalEvidence: z.record(z.unknown()).optional(),
});
export type VoidInvoiceRequest = z.infer<typeof voidInvoiceRequestSchema>;

export const creditNoteLineWriteSchema = z.object({
  invoiceLineId: z.string().uuid().optional(),
  description: z.string().min(1).max(500),
  amount: moneyAmountStringSchema,
});
export type CreditNoteLineWrite = z.infer<typeof creditNoteLineWriteSchema>;

export const createCreditNoteRequestSchema = z.object({
  invoiceId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
  currency: currencyCodeSchema,
  lines: z.array(creditNoteLineWriteSchema).min(1).max(50),
  issueDate: dateOnlySchema.optional(),
  notes: z.string().max(4000).optional(),
});
export type CreateCreditNoteRequest = z.infer<typeof createCreditNoteRequestSchema>;

export const creditNoteResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  creditNoteNumber: z.string().nullable(),
  status: creditNoteStatusSchema,
  currency: currencyCodeSchema,
  reason: z.string(),
  totalAmount: moneyAmountStringSchema,
  version: z.number().int(),
  postedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CreditNoteResponse = z.infer<typeof creditNoteResponseSchema>;

export const creditNotesCollectionSchema = createCursorCollectionSchema(creditNoteResponseSchema);
export type CreditNotesCollection = z.infer<typeof creditNotesCollectionSchema>;

export const postCreditNoteRequestSchema = z.object({
  postedAt: z.string().datetime(),
  approvalEvidence: z.record(z.unknown()).optional(),
});
export type PostCreditNoteRequest = z.infer<typeof postCreditNoteRequestSchema>;

export const securityDepositResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  leaseId: z.string().uuid(),
  propertyId: z.string().uuid(),
  payerPartyId: z.string().uuid(),
  status: securityDepositStatusSchema,
  currency: currencyCodeSchema,
  requiredAmount: moneyAmountStringSchema,
  heldAmount: moneyAmountStringSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type SecurityDepositResponse = z.infer<typeof securityDepositResponseSchema>;

export const depositsCollectionSchema = createCursorCollectionSchema(securityDepositResponseSchema);
export type DepositsCollection = z.infer<typeof depositsCollectionSchema>;

export const ledgerEntryResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  accountCode: z.string().min(1).max(64),
  side: ledgerEntrySideSchema,
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  effectiveAt: z.string().datetime(),
  sourceType: z.string().min(1).max(64),
  sourceId: z.string().uuid(),
  leaseId: z.string().uuid().nullable(),
  propertyId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type LedgerEntryResponse = z.infer<typeof ledgerEntryResponseSchema>;

export const ledgerEntriesCollectionSchema =
  createCursorCollectionSchema(ledgerEntryResponseSchema);
export type LedgerEntriesCollection = z.infer<typeof ledgerEntriesCollectionSchema>;

export const balanceSummaryResponseSchema = z.object({
  scope: z.object({
    leaseId: z.string().uuid().optional(),
    residentId: z.string().uuid().optional(),
    propertyId: z.string().uuid().optional(),
  }),
  asOf: z.string().datetime(),
  currency: currencyCodeSchema,
  openingAmount: moneyAmountStringSchema,
  chargesAmount: moneyAmountStringSchema,
  creditsAmount: moneyAmountStringSchema,
  paymentsAmount: moneyAmountStringSchema,
  refundsAmount: moneyAmountStringSchema,
  writeOffsAmount: moneyAmountStringSchema,
  depositsAmount: moneyAmountStringSchema,
  closingAmount: moneyAmountStringSchema,
});
export type BalanceSummaryResponse = z.infer<typeof balanceSummaryResponseSchema>;

export const meterWriteSchema = z.object({
  meterType: meterTypeSchema,
  serialNumber: z.string().min(1).max(120),
  name: z.string().max(200).optional(),
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().optional(),
  multiplier: moneyAmountStringSchema.optional(),
  installedAt: dateOnlySchema.optional(),
});
export type MeterWrite = z.infer<typeof meterWriteSchema>;

export const meterResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  meterType: meterTypeSchema,
  status: meterStatusSchema,
  serialNumber: z.string(),
  name: z.string().nullable(),
  propertyId: z.string().uuid(),
  unitId: z.string().uuid().nullable(),
  multiplier: moneyAmountStringSchema,
  installedAt: dateOnlySchema.nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type MeterResponse = z.infer<typeof meterResponseSchema>;

export const metersCollectionSchema = createCursorCollectionSchema(meterResponseSchema);
export type MetersCollection = z.infer<typeof metersCollectionSchema>;

export const meterReadingBulkItemSchema = z.object({
  clientItemId: z.string().min(1).max(64),
  meterId: z.string().uuid(),
  readAt: z.string().datetime(),
  value: moneyAmountStringSchema,
  source: z.string().min(1).max(64),
  qualityFlag: meterReadingQualitySchema.optional(),
  evidenceDocumentIds: z.array(z.string().uuid()).max(10).optional(),
});
export type MeterReadingBulkItem = z.infer<typeof meterReadingBulkItemSchema>;

export const meterReadingBulkRequestSchema = z.object({
  items: z.array(meterReadingBulkItemSchema).min(1).max(1000),
  validateOnly: z.boolean().optional(),
  mode: z.enum(['PARTIAL', 'ATOMIC']).optional(),
});
export type MeterReadingBulkRequest = z.infer<typeof meterReadingBulkRequestSchema>;

export const utilityAllocationPreviewRequestSchema = z.object({
  propertyId: z.string().uuid(),
  utilityType: meterTypeSchema,
  servicePeriod: periodKeySchema,
  method: utilityAllocationMethodSchema,
  tariffId: z.string().uuid(),
  meterIds: z.array(z.string().uuid()).max(500).optional(),
  vacancyTreatment: z.string().max(64).optional(),
  commonAreaShare: moneyAmountStringSchema.optional(),
});
export type UtilityAllocationPreviewRequest = z.infer<typeof utilityAllocationPreviewRequestSchema>;

export const utilityAllocationCommitRequestSchema = z.object({
  approvalEvidence: z.record(z.unknown()).optional(),
});
export type UtilityAllocationCommitRequest = z.infer<typeof utilityAllocationCommitRequestSchema>;

export const utilityAllocationRunResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  utilityType: meterTypeSchema,
  servicePeriod: periodKeySchema,
  method: utilityAllocationMethodSchema,
  tariffId: z.string().uuid(),
  status: utilityAllocationRunStatusSchema,
  currency: currencyCodeSchema,
  totalAllocatedAmount: moneyAmountStringSchema,
  operationId: z.string().nullable(),
  asOf: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UtilityAllocationRunResponse = z.infer<typeof utilityAllocationRunResponseSchema>;
