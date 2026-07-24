import {
  arrearsCollectionSchema,
  createDepositDispositionRequestSchema,
  depositDispositionsBatchResponseSchema,
  depositDispositionResponseSchema,
  dispositionDecisionRequestSchema,
  executeDepositDispositionRequestSchema,
  financeDashboardSummarySchema,
  IDEMPOTENCY_KEY_HEADER,
  manualPaymentCreateSchema,
  ORGANIZATION_ARREARS_PATH,
  ORGANIZATION_DEPOSIT_DISPOSITIONS_PATH,
  ORGANIZATION_DISPOSITION_APPROVE_PATH,
  ORGANIZATION_DISPOSITION_EXECUTE_PATH,
  ORGANIZATION_FINANCE_DASHBOARD_PATH,
  ORGANIZATION_PAYMENT_BY_ID_PATH,
  ORGANIZATION_PAYMENT_REVERSE_PATH,
  ORGANIZATION_PAYMENT_TRANSACTION_ALLOCATIONS_PATH,
  ORGANIZATION_PAYMENTS_PATH,
  ORGANIZATION_RECEIPT_BY_ID_PATH,
  ORGANIZATION_REFUND_APPROVE_PATH,
  ORGANIZATION_REFUND_EXECUTE_PATH,
  ORGANIZATION_REFUNDS_PATH,
  paymentTransactionResponseSchema,
  paymentsCollectionSchema,
  receiptResponseSchema,
  refundCreateSchema,
  refundDecisionRequestSchema,
  refundExecuteRequestSchema,
  refundResponseSchema,
  type AllocationCreate,
  type ArrearsCollection,
  type CreateDepositDispositionRequest,
  type DepositDispositionResponse,
  type DepositDispositionsBatchResponse,
  type DispositionDecisionRequest,
  type ExecuteDepositDispositionRequest,
  type FinanceDashboardSummary,
  type ManualPaymentCreate,
  type PaymentReverseRequest,
  type PaymentTransactionResponse,
  type PaymentsCollection,
  type ReceiptResponse,
  type RefundCreate,
  type RefundDecisionRequest,
  type RefundExecuteRequest,
  type RefundResponse,
} from '@rpm/contracts';

import { authFetch } from './auth-api';

function orgPath(
  template: string,
  organizationId: string,
  extra: Record<string, string> = {},
): string {
  let path = template.replace('{organizationId}', encodeURIComponent(organizationId));
  for (const [key, value] of Object.entries(extra)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}

function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export type ListPaymentsOptions = {
  limit?: number;
  after?: string;
  leaseId?: string;
  propertyId?: string;
  status?: string;
  channel?: string;
};

export async function listPayments(
  accessToken: string,
  organizationId: string,
  options?: ListPaymentsOptions,
): Promise<PaymentsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_PAYMENTS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    leaseId: options?.leaseId,
    propertyId: options?.propertyId,
    status: options?.status,
    channel: options?.channel,
  });
  const response = await authFetch(path, {}, accessToken);
  return paymentsCollectionSchema.parse(await response.json());
}

export async function getPayment(
  accessToken: string,
  organizationId: string,
  paymentId: string,
): Promise<PaymentTransactionResponse> {
  const path = orgPath(ORGANIZATION_PAYMENT_BY_ID_PATH, organizationId, { paymentId });
  const response = await authFetch(path, {}, accessToken);
  return paymentTransactionResponseSchema.parse(await response.json());
}

export async function recordManualPayment(
  accessToken: string,
  organizationId: string,
  body: ManualPaymentCreate,
  idempotencyKey: string,
): Promise<PaymentTransactionResponse> {
  const parsed = manualPaymentCreateSchema.parse(body);
  const path = orgPath(ORGANIZATION_PAYMENTS_PATH, organizationId);
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return paymentTransactionResponseSchema.parse(await response.json());
}

export async function allocatePayment(
  accessToken: string,
  organizationId: string,
  paymentTransactionId: string,
  body: AllocationCreate,
  idempotencyKey: string,
): Promise<PaymentTransactionResponse> {
  const path = orgPath(ORGANIZATION_PAYMENT_TRANSACTION_ALLOCATIONS_PATH, organizationId, {
    paymentTransactionId,
  });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return paymentTransactionResponseSchema.parse(await response.json());
}

export async function getReceipt(
  accessToken: string,
  organizationId: string,
  receiptId: string,
): Promise<ReceiptResponse> {
  const path = orgPath(ORGANIZATION_RECEIPT_BY_ID_PATH, organizationId, { receiptId });
  const response = await authFetch(path, {}, accessToken);
  return receiptResponseSchema.parse(await response.json());
}

export async function listArrears(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string; propertyId?: string },
): Promise<ArrearsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_ARREARS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    propertyId: options?.propertyId,
  });
  const response = await authFetch(path, {}, accessToken);
  return arrearsCollectionSchema.parse(await response.json());
}

export async function getFinanceDashboard(
  accessToken: string,
  organizationId: string,
): Promise<FinanceDashboardSummary> {
  const path = orgPath(ORGANIZATION_FINANCE_DASHBOARD_PATH, organizationId);
  const response = await authFetch(path, {}, accessToken);
  return financeDashboardSummarySchema.parse(await response.json());
}

export async function createDepositDispositions(
  accessToken: string,
  organizationId: string,
  depositId: string,
  body: CreateDepositDispositionRequest,
  idempotencyKey: string,
): Promise<DepositDispositionsBatchResponse> {
  const parsed = createDepositDispositionRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DEPOSIT_DISPOSITIONS_PATH, organizationId, { depositId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return depositDispositionsBatchResponseSchema.parse(await response.json());
}

export async function executeDepositDisposition(
  accessToken: string,
  organizationId: string,
  dispositionId: string,
  body: ExecuteDepositDispositionRequest,
  idempotencyKey: string,
): Promise<DepositDispositionResponse> {
  const parsed = executeDepositDispositionRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DISPOSITION_EXECUTE_PATH, organizationId, { dispositionId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return depositDispositionResponseSchema.parse(await response.json());
}

export async function approveDepositDisposition(
  accessToken: string,
  organizationId: string,
  dispositionId: string,
  body: DispositionDecisionRequest,
  idempotencyKey: string,
): Promise<DepositDispositionResponse> {
  const parsed = dispositionDecisionRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DISPOSITION_APPROVE_PATH, organizationId, {
    dispositionId,
  });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return depositDispositionResponseSchema.parse(await response.json());
}

export async function requestRefund(
  accessToken: string,
  organizationId: string,
  body: RefundCreate,
  idempotencyKey: string,
): Promise<RefundResponse> {
  const parsed = refundCreateSchema.parse(body);
  const path = orgPath(ORGANIZATION_REFUNDS_PATH, organizationId);
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return refundResponseSchema.parse(await response.json());
}

export async function approveRefund(
  accessToken: string,
  organizationId: string,
  refundId: string,
  body: RefundDecisionRequest,
  idempotencyKey: string,
): Promise<RefundResponse> {
  const parsed = refundDecisionRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_REFUND_APPROVE_PATH, organizationId, { refundId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return refundResponseSchema.parse(await response.json());
}

export async function executeRefund(
  accessToken: string,
  organizationId: string,
  refundId: string,
  body: RefundExecuteRequest,
  idempotencyKey: string,
): Promise<RefundResponse> {
  const parsed = refundExecuteRequestSchema.parse(body ?? {});
  const path = orgPath(ORGANIZATION_REFUND_EXECUTE_PATH, organizationId, { refundId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  return refundResponseSchema.parse(await response.json());
}

export async function reversePayment(
  accessToken: string,
  organizationId: string,
  paymentId: string,
  body: PaymentReverseRequest,
  idempotencyKey: string,
): Promise<{ payment: PaymentTransactionResponse }> {
  const path = orgPath(ORGANIZATION_PAYMENT_REVERSE_PATH, organizationId, { paymentId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    },
    accessToken,
  );
  const json = (await response.json()) as { payment: unknown };
  return { payment: paymentTransactionResponseSchema.parse(json.payment) };
}
