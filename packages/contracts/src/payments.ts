import { z } from 'zod';

import { currencyCodeSchema, moneyAmountStringSchema } from './money';
import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const PAYMENT_PERMISSION_KEYS = {
  LIST: PERMISSION_KEYS.FINANCE_PAYMENTS_LIST,
  VIEW: PERMISSION_KEYS.FINANCE_PAYMENTS_VIEW,
  RECORD: PERMISSION_KEYS.FINANCE_PAYMENTS_RECORD,
  ALLOCATE: PERMISSION_KEYS.FINANCE_PAYMENTS_ALLOCATE,
  REFUNDS_REQUEST: PERMISSION_KEYS.FINANCE_REFUNDS_REQUEST,
  REFUNDS_APPROVE: PERMISSION_KEYS.FINANCE_REFUNDS_APPROVE,
  REFUNDS_EXECUTE: PERMISSION_KEYS.FINANCE_REFUNDS_EXECUTE,
  DEPOSITS_DISPOSE: PERMISSION_KEYS.FINANCE_DEPOSITS_DISPOSE,
  DEPOSITS_DISPOSITION: PERMISSION_KEYS.FINANCE_DEPOSITS_DISPOSITION,
  DEPOSITS_DISPOSITION_APPROVE: PERMISSION_KEYS.FINANCE_DEPOSITS_DISPOSITION_APPROVE,
} as const;

export const ORGANIZATION_PAYMENTS_PATH = '/v1/organizations/{organizationId}/payments' as const;
export const ORGANIZATION_PAYMENT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/payments/{paymentId}' as const;
export const ORGANIZATION_PAYMENT_TRANSACTION_ALLOCATIONS_PATH =
  '/v1/organizations/{organizationId}/payment-transactions/{paymentTransactionId}/allocations' as const;
export const ORGANIZATION_PAYMENT_INTENTS_PATH =
  '/v1/organizations/{organizationId}/payment-intents' as const;
export const ORGANIZATION_REFUNDS_PATH = '/v1/organizations/{organizationId}/refunds' as const;
export const ORGANIZATION_REFUND_APPROVE_PATH =
  '/v1/organizations/{organizationId}/refunds/{refundId}/approve' as const;
export const ORGANIZATION_REFUND_EXECUTE_PATH =
  '/v1/organizations/{organizationId}/refunds/{refundId}/execute' as const;
export const ORGANIZATION_RECEIPT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/receipts/{receiptId}' as const;
export const ORGANIZATION_ARREARS_PATH = '/v1/organizations/{organizationId}/arrears' as const;
export const ORGANIZATION_FINANCE_DASHBOARD_PATH =
  '/v1/organizations/{organizationId}/dashboard/finance' as const;
export const ORGANIZATION_DEPOSIT_DISPOSITIONS_PATH =
  '/v1/organizations/{organizationId}/deposits/{depositId}/dispositions' as const;
export const ORGANIZATION_DISPOSITION_EXECUTE_PATH =
  '/v1/organizations/{organizationId}/dispositions/{dispositionId}/execute' as const;
export const ORGANIZATION_DISPOSITION_APPROVE_PATH =
  '/v1/organizations/{organizationId}/deposit-dispositions/{dispositionId}/approve' as const;
export const ORGANIZATION_PAYMENT_REVERSE_PATH =
  '/v1/organizations/{organizationId}/payments/{paymentId}/reverse' as const;
export const PROVIDER_WEBHOOK_PATH = '/v1/provider/webhooks/{provider}' as const;

export const PAYMENT_RECORDED_EVENT_TYPE = 'payment.recorded' as const;
export const PAYMENT_ALLOCATED_EVENT_TYPE = 'payment.allocated' as const;
export const RECEIPT_ISSUED_EVENT_TYPE = 'receipt.issued' as const;
export const DEPOSIT_DISPOSITION_EXECUTED_EVENT_TYPE = 'deposit.disposition_executed' as const;

export const paymentChannelSchema = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'QR',
  'CHECK',
  'CARD_HOSTED',
  'OTHER',
]);
export type PaymentChannel = z.infer<typeof paymentChannelSchema>;

export const manualPaymentChannelSchema = z.enum(['CASH', 'BANK_TRANSFER', 'QR', 'CHECK', 'OTHER']);
export type ManualPaymentChannel = z.infer<typeof manualPaymentChannelSchema>;

export const paymentTransactionStatusSchema = z.enum(['PENDING', 'SETTLED', 'FAILED', 'REVERSED']);
export type PaymentTransactionStatus = z.infer<typeof paymentTransactionStatusSchema>;

export const paymentIntentStatusSchema = z.enum([
  'CREATED',
  'REQUIRES_ACTION',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);
export type PaymentIntentStatus = z.infer<typeof paymentIntentStatusSchema>;

export const refundStatusSchema = z.enum([
  'PENDING',
  'APPROVED',
  'EXECUTED',
  'REJECTED',
  'CANCELLED',
]);
export type RefundStatus = z.infer<typeof refundStatusSchema>;

export const depositDispositionTypeSchema = z.enum([
  'DEDUCTION',
  'REFUND',
  'FORFEIT',
  'TRANSFER',
  'REMAINING_HELD',
]);
export type DepositDispositionType = z.infer<typeof depositDispositionTypeSchema>;

export const depositDispositionStatusSchema = z.enum([
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTED',
  'REJECTED',
]);
export type DepositDispositionStatus = z.infer<typeof depositDispositionStatusSchema>;

export const paymentAllocationWriteSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: moneyAmountStringSchema,
});
export type PaymentAllocationWrite = z.infer<typeof paymentAllocationWriteSchema>;

export const manualPaymentCreateSchema = z.object({
  channel: manualPaymentChannelSchema,
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  receivedAt: z.string().datetime(),
  externalReference: z.string().min(1).max(200).optional(),
  leaseId: z.string().uuid(),
  payerPartyId: z.string().uuid(),
  propertyId: z.string().uuid(),
  allocations: z.array(paymentAllocationWriteSchema).max(50).default([]),
  notes: z.string().max(4000).optional(),
  evidenceDocumentId: z.string().uuid().optional(),
});
export type ManualPaymentCreate = z.infer<typeof manualPaymentCreateSchema>;

export const allocationCreateSchema = z.object({
  allocations: z.array(paymentAllocationWriteSchema).min(1).max(50),
  effectiveAt: z.string().datetime().optional(),
});
export type AllocationCreate = z.infer<typeof allocationCreateSchema>;

export const paymentIntentCreateSchema = z
  .object({
    amount: moneyAmountStringSchema,
    currency: currencyCodeSchema,
    channel: paymentChannelSchema.default('CARD_HOSTED'),
    leaseId: z.string().uuid().optional(),
    invoiceId: z.string().uuid().optional(),
    payerPartyId: z.string().uuid().optional(),
    returnUrl: z.string().url().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((value) => value.leaseId !== undefined || value.invoiceId !== undefined, {
    message: 'invoiceId or leaseId is required',
    path: ['invoiceId'],
  });
export type PaymentIntentCreate = z.infer<typeof paymentIntentCreateSchema>;

export const refundCreateSchema = z.object({
  paymentTransactionId: z.string().uuid(),
  amount: moneyAmountStringSchema,
  reason: z.string().min(3).max(2000),
});
export type RefundCreate = z.infer<typeof refundCreateSchema>;

export const depositDispositionLineWriteSchema = z.object({
  dispositionType: depositDispositionTypeSchema,
  amount: moneyAmountStringSchema,
  reason: z.string().min(3).max(2000),
});
export type DepositDispositionLineWrite = z.infer<typeof depositDispositionLineWriteSchema>;

export const createDepositDispositionRequestSchema = z.object({
  lines: z.array(depositDispositionLineWriteSchema).min(1).max(20),
  effectiveAt: z.string().datetime(),
});
export type CreateDepositDispositionRequest = z.infer<typeof createDepositDispositionRequestSchema>;

export const executeDepositDispositionRequestSchema = z.object({
  executedAt: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});
export type ExecuteDepositDispositionRequest = z.infer<
  typeof executeDepositDispositionRequestSchema
>;

export const paymentAllocationResponseSchema = z.object({
  id: z.string().uuid(),
  paymentTransactionId: z.string().uuid(),
  invoiceId: z.string().uuid(),
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  effectiveAt: z.string().datetime(),
  reversedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type PaymentAllocationResponse = z.infer<typeof paymentAllocationResponseSchema>;

export const paymentReconciliationStatusSchema = z.enum(['UNRECONCILED', 'MATCHED', 'EXCEPTION']);
export type PaymentReconciliationStatus = z.infer<typeof paymentReconciliationStatusSchema>;

export const paymentTransactionResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  intentId: z.string().uuid().nullable(),
  leaseId: z.string().uuid().nullable(),
  propertyId: z.string().uuid().nullable(),
  payerPartyId: z.string().uuid().nullable(),
  amount: moneyAmountStringSchema,
  unallocatedAmount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  channel: paymentChannelSchema,
  status: paymentTransactionStatusSchema,
  reconciliationStatus: paymentReconciliationStatusSchema.optional(),
  externalReference: z.string().nullable(),
  provider: z.string().nullable(),
  providerPaymentId: z.string().nullable(),
  receivedAt: z.string().datetime(),
  accountingAt: z.string().datetime(),
  notes: z.string().nullable(),
  evidenceDocumentId: z.string().uuid().nullable(),
  receiptId: z.string().uuid().nullable(),
  version: z.number().int(),
  allocations: z.array(paymentAllocationResponseSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentTransactionResponse = z.infer<typeof paymentTransactionResponseSchema>;

export const paymentsCollectionSchema = createCursorCollectionSchema(
  paymentTransactionResponseSchema,
);
export type PaymentsCollection = z.infer<typeof paymentsCollectionSchema>;

export const paymentIntentResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  leaseId: z.string().uuid().nullable(),
  invoiceId: z.string().uuid().nullable(),
  payerPartyId: z.string().uuid().nullable(),
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  channel: paymentChannelSchema,
  status: paymentIntentStatusSchema,
  provider: z.string(),
  providerIntentId: z.string().nullable(),
  checkoutUrl: z.string().nullable(),
  failureReason: z.string().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaymentIntentResponse = z.infer<typeof paymentIntentResponseSchema>;

export const refundResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  paymentTransactionId: z.string().uuid(),
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  reason: z.string(),
  status: refundStatusSchema,
  requestedByUserId: z.string().uuid().nullable(),
  approvedByUserId: z.string().uuid().nullable(),
  approvedAt: z.string().datetime().nullable().optional(),
  executedByUserId: z.string().uuid().nullable().optional(),
  executedAt: z.string().datetime().nullable(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RefundResponse = z.infer<typeof refundResponseSchema>;

export const receiptResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  paymentTransactionId: z.string().uuid(),
  receiptNumber: z.string(),
  issuedAt: z.string().datetime(),
  currency: currencyCodeSchema,
  amount: moneyAmountStringSchema,
  summary: z.record(z.unknown()),
  documentId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReceiptResponse = z.infer<typeof receiptResponseSchema>;

export const arrearsItemSchema = z.object({
  invoiceId: z.string().uuid(),
  leaseId: z.string().uuid(),
  propertyId: z.string().uuid(),
  invoiceNumber: z.string().nullable(),
  status: z.enum(['POSTED', 'PARTIALLY_PAID']),
  currency: currencyCodeSchema,
  balanceAmount: moneyAmountStringSchema,
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  daysPastDue: z.number().int().nullable(),
});
export type ArrearsItem = z.infer<typeof arrearsItemSchema>;

export const arrearsCollectionSchema = createCursorCollectionSchema(arrearsItemSchema);
export type ArrearsCollection = z.infer<typeof arrearsCollectionSchema>;

export const financeDashboardSummarySchema = z.object({
  organizationId: z.string().uuid(),
  asOf: z.string().datetime(),
  outstandingTotal: moneyAmountStringSchema,
  unpaidInvoiceCount: z.number().int().nonnegative(),
  collectedThisPeriod: moneyAmountStringSchema,
  depositsHeldTotal: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  recentPayments: z.array(paymentTransactionResponseSchema).max(10),
  financeNote: z.string(),
});
export type FinanceDashboardSummary = z.infer<typeof financeDashboardSummarySchema>;

export const depositDispositionResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  depositId: z.string().uuid(),
  dispositionType: depositDispositionTypeSchema,
  amount: moneyAmountStringSchema,
  currency: currencyCodeSchema,
  reason: z.string(),
  status: depositDispositionStatusSchema,
  effectiveAt: z.string().datetime(),
  executedAt: z.string().datetime().nullable(),
  requestedByUserId: z.string().uuid().nullable(),
  approvedByUserId: z.string().uuid().nullable(),
  executedByUserId: z.string().uuid().nullable().optional(),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DepositDispositionResponse = z.infer<typeof depositDispositionResponseSchema>;

export const depositDispositionsBatchResponseSchema = z.object({
  depositId: z.string().uuid(),
  lines: z.array(depositDispositionResponseSchema),
});
export type DepositDispositionsBatchResponse = z.infer<
  typeof depositDispositionsBatchResponseSchema
>;

export const providerWebhookAcceptedResponseSchema = z.object({
  accepted: z.boolean(),
  eventId: z.string().uuid(),
  processingStatus: z.enum(['RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED']),
  replayed: z.boolean(),
});
export type ProviderWebhookAcceptedResponse = z.infer<typeof providerWebhookAcceptedResponseSchema>;
