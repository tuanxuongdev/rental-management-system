import {
  approveBillingRunRequestSchema,
  billingRunPreviewRequestSchema,
  billingRunPreviewResponseSchema,
  billingRunResponseSchema,
  billingRunsCollectionSchema,
  commitBillingRunRequestSchema,
  createBillingRunRequestSchema,
  creditNotesCollectionSchema,
  depositsCollectionSchema,
  invoiceResponseSchema,
  invoicesCollectionSchema,
  meterReadingBulkRequestSchema,
  metersCollectionSchema,
  postCreditNoteRequestSchema,
  postInvoiceRequestSchema,
  retryBillingRunRequestSchema,
  utilityAllocationCommitRequestSchema,
  utilityAllocationPreviewRequestSchema,
  utilityAllocationRunResponseSchema,
  voidInvoiceRequestSchema,
  ORGANIZATION_BILLING_RUN_APPROVE_PATH,
  ORGANIZATION_BILLING_RUN_BY_ID_PATH,
  ORGANIZATION_BILLING_RUN_COMMIT_PATH,
  ORGANIZATION_BILLING_RUN_PREVIEW_PATH,
  ORGANIZATION_BILLING_RUN_RETRY_PATH,
  ORGANIZATION_BILLING_RUNS_PATH,
  ORGANIZATION_CREDIT_NOTE_POST_PATH,
  ORGANIZATION_CREDIT_NOTES_PATH,
  ORGANIZATION_DEPOSITS_PATH,
  ORGANIZATION_INVOICE_BY_ID_PATH,
  ORGANIZATION_INVOICE_POST_PATH,
  ORGANIZATION_INVOICE_VOID_PATH,
  ORGANIZATION_INVOICES_PATH,
  ORGANIZATION_METER_READINGS_BULK_PATH,
  ORGANIZATION_METERS_PATH,
  ORGANIZATION_UTILITY_ALLOCATION_RUN_BY_ID_PATH,
  ORGANIZATION_UTILITY_ALLOCATION_RUN_COMMIT_PATH,
  ORGANIZATION_UTILITY_ALLOCATION_RUN_PREVIEW_PATH,
  ORGANIZATION_UTILITY_ALLOCATION_RUNS_PATH,
  type ApproveBillingRunRequest,
  type BillingRunPreviewRequest,
  type BillingRunPreviewResponse,
  type BillingRunResponse,
  type BillingRunsCollection,
  type CommitBillingRunRequest,
  type CreateBillingRunRequest,
  type CreditNotesCollection,
  type DepositsCollection,
  type InvoiceResponse,
  type InvoicesCollection,
  type MeterReadingBulkRequest,
  type MetersCollection,
  type PostCreditNoteRequest,
  type PostInvoiceRequest,
  type RetryBillingRunRequest,
  type UtilityAllocationCommitRequest,
  type UtilityAllocationPreviewRequest,
  type UtilityAllocationRunResponse,
  type VoidInvoiceRequest,
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

function ifMatchHeaders(version?: number): HeadersInit | undefined {
  if (version === undefined) {
    return undefined;
  }
  return { 'If-Match': String(version) };
}

export type ListInvoicesOptions = {
  limit?: number;
  after?: string;
  status?: string;
  leaseId?: string;
  propertyId?: string;
  periodKey?: string;
};

export async function listInvoices(
  accessToken: string,
  organizationId: string,
  options?: ListInvoicesOptions,
): Promise<InvoicesCollection> {
  const path = withQuery(orgPath(ORGANIZATION_INVOICES_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    status: options?.status,
    leaseId: options?.leaseId,
    propertyId: options?.propertyId,
    periodKey: options?.periodKey,
  });
  const response = await authFetch(path, {}, accessToken);
  return invoicesCollectionSchema.parse(await response.json());
}

export async function getInvoice(
  accessToken: string,
  organizationId: string,
  invoiceId: string,
): Promise<InvoiceResponse> {
  const path = orgPath(ORGANIZATION_INVOICE_BY_ID_PATH, organizationId, { invoiceId });
  const response = await authFetch(path, {}, accessToken);
  return invoiceResponseSchema.parse(await response.json());
}

export async function postInvoice(
  accessToken: string,
  organizationId: string,
  invoiceId: string,
  body: PostInvoiceRequest,
  version: number,
  idempotencyKey: string,
): Promise<InvoiceResponse> {
  const parsed = postInvoiceRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_INVOICE_POST_PATH, organizationId, { invoiceId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return invoiceResponseSchema.parse(await response.json());
}

export async function voidInvoice(
  accessToken: string,
  organizationId: string,
  invoiceId: string,
  body: VoidInvoiceRequest,
  version: number,
  idempotencyKey: string,
): Promise<InvoiceResponse> {
  const parsed = voidInvoiceRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_INVOICE_VOID_PATH, organizationId, { invoiceId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return invoiceResponseSchema.parse(await response.json());
}

export type ListBillingRunsOptions = {
  limit?: number;
  after?: string;
  periodKey?: string;
  status?: string;
};

export async function listBillingRuns(
  accessToken: string,
  organizationId: string,
  options?: ListBillingRunsOptions,
): Promise<BillingRunsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_BILLING_RUNS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    periodKey: options?.periodKey,
    status: options?.status,
  });
  const response = await authFetch(path, {}, accessToken);
  return billingRunsCollectionSchema.parse(await response.json());
}

export async function getBillingRun(
  accessToken: string,
  organizationId: string,
  billingRunId: string,
): Promise<BillingRunResponse> {
  const path = orgPath(ORGANIZATION_BILLING_RUN_BY_ID_PATH, organizationId, { billingRunId });
  const response = await authFetch(path, {}, accessToken);
  return billingRunResponseSchema.parse(await response.json());
}

export async function createBillingRun(
  accessToken: string,
  organizationId: string,
  body: CreateBillingRunRequest,
  idempotencyKey: string,
): Promise<BillingRunResponse> {
  const parsed = createBillingRunRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BILLING_RUNS_PATH, organizationId);
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return billingRunResponseSchema.parse(await response.json());
}

export async function previewBillingRun(
  accessToken: string,
  organizationId: string,
  billingRunId: string,
  body: BillingRunPreviewRequest | undefined,
  version: number,
): Promise<BillingRunPreviewResponse> {
  const parsed = billingRunPreviewRequestSchema.parse(body ?? {});
  const path = orgPath(ORGANIZATION_BILLING_RUN_PREVIEW_PATH, organizationId, { billingRunId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return billingRunPreviewResponseSchema.parse(await response.json());
}

export async function approveBillingRun(
  accessToken: string,
  organizationId: string,
  billingRunId: string,
  body: ApproveBillingRunRequest,
  version: number,
): Promise<BillingRunResponse> {
  const parsed = approveBillingRunRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BILLING_RUN_APPROVE_PATH, organizationId, { billingRunId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return billingRunResponseSchema.parse(await response.json());
}

export async function commitBillingRun(
  accessToken: string,
  organizationId: string,
  billingRunId: string,
  body: CommitBillingRunRequest,
  version: number,
  idempotencyKey: string,
): Promise<BillingRunResponse> {
  const parsed = commitBillingRunRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BILLING_RUN_COMMIT_PATH, organizationId, { billingRunId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return billingRunResponseSchema.parse(await response.json());
}

export async function retryBillingRun(
  accessToken: string,
  organizationId: string,
  billingRunId: string,
  body: RetryBillingRunRequest,
  version: number,
  idempotencyKey: string,
): Promise<BillingRunResponse> {
  const parsed = retryBillingRunRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BILLING_RUN_RETRY_PATH, organizationId, { billingRunId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return billingRunResponseSchema.parse(await response.json());
}

export type ListDepositsOptions = {
  limit?: number;
  after?: string;
  leaseId?: string;
  propertyId?: string;
  status?: string;
};

export async function listDeposits(
  accessToken: string,
  organizationId: string,
  options?: ListDepositsOptions,
): Promise<DepositsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_DEPOSITS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    leaseId: options?.leaseId,
    propertyId: options?.propertyId,
    status: options?.status,
  });
  const response = await authFetch(path, {}, accessToken);
  return depositsCollectionSchema.parse(await response.json());
}

export type ListCreditNotesOptions = {
  limit?: number;
  after?: string;
  invoiceId?: string;
  status?: string;
};

export async function listCreditNotes(
  accessToken: string,
  organizationId: string,
  options?: ListCreditNotesOptions,
): Promise<CreditNotesCollection> {
  const path = withQuery(orgPath(ORGANIZATION_CREDIT_NOTES_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    invoiceId: options?.invoiceId,
    status: options?.status,
  });
  const response = await authFetch(path, {}, accessToken);
  return creditNotesCollectionSchema.parse(await response.json());
}

export async function postCreditNote(
  accessToken: string,
  organizationId: string,
  creditNoteId: string,
  body: PostCreditNoteRequest,
  version: number,
  idempotencyKey: string,
): Promise<void> {
  const parsed = postCreditNoteRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_CREDIT_NOTE_POST_PATH, organizationId, { creditNoteId });
  await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
}

export type ListMetersOptions = {
  limit?: number;
  after?: string;
  propertyId?: string;
  status?: string;
};

export async function listMeters(
  accessToken: string,
  organizationId: string,
  options?: ListMetersOptions,
): Promise<MetersCollection> {
  const path = withQuery(orgPath(ORGANIZATION_METERS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    propertyId: options?.propertyId,
    status: options?.status,
  });
  const response = await authFetch(path, {}, accessToken);
  return metersCollectionSchema.parse(await response.json());
}

export async function bulkMeterReadings(
  accessToken: string,
  organizationId: string,
  body: MeterReadingBulkRequest,
  idempotencyKey: string,
): Promise<void> {
  const parsed = meterReadingBulkRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_METER_READINGS_BULK_PATH, organizationId);
  await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
}

export async function previewUtilityAllocation(
  accessToken: string,
  organizationId: string,
  body: UtilityAllocationPreviewRequest,
): Promise<UtilityAllocationRunResponse> {
  const parsed = utilityAllocationPreviewRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_UTILITY_ALLOCATION_RUN_PREVIEW_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(parsed) },
    accessToken,
  );
  return utilityAllocationRunResponseSchema.parse(await response.json());
}

export async function getUtilityAllocationRun(
  accessToken: string,
  organizationId: string,
  runId: string,
): Promise<UtilityAllocationRunResponse> {
  const path = orgPath(ORGANIZATION_UTILITY_ALLOCATION_RUN_BY_ID_PATH, organizationId, { runId });
  const response = await authFetch(path, {}, accessToken);
  return utilityAllocationRunResponseSchema.parse(await response.json());
}

export async function commitUtilityAllocationRun(
  accessToken: string,
  organizationId: string,
  runId: string,
  body: UtilityAllocationCommitRequest,
  idempotencyKey: string,
): Promise<UtilityAllocationRunResponse> {
  const parsed = utilityAllocationCommitRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_UTILITY_ALLOCATION_RUN_COMMIT_PATH, organizationId, { runId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return utilityAllocationRunResponseSchema.parse(await response.json());
}

export async function listUtilityAllocationRuns(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string; propertyId?: string },
): Promise<{ data: UtilityAllocationRunResponse[] }> {
  const path = withQuery(orgPath(ORGANIZATION_UTILITY_ALLOCATION_RUNS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    propertyId: options?.propertyId,
  });
  const response = await authFetch(path, {}, accessToken);
  const json = (await response.json()) as { data?: UtilityAllocationRunResponse[] };
  return { data: json.data ?? [] };
}
