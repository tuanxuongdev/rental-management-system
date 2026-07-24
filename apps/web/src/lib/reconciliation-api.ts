import {
  accountingPeriodResponseSchema,
  accountingPeriodsCollectionSchema,
  completeReconciliationRunRequestSchema,
  createReconciliationRunRequestSchema,
  financeExportRequestSchema,
  financeExportResponseSchema,
  IDEMPOTENCY_KEY_HEADER,
  ingestSettlementsRequestSchema,
  invoiceAgingResponseSchema,
  ORGANIZATION_ACCOUNTING_PERIOD_CLOSE_PATH,
  ORGANIZATION_ACCOUNTING_PERIODS_PATH,
  ORGANIZATION_AGING_PATH,
  ORGANIZATION_BILLING_COMPARISONS_PARALLEL_PATH,
  ORGANIZATION_EXPORTS_FINANCE_PATH,
  ORGANIZATION_RECONCILIATION_COMPLETE_PATH,
  ORGANIZATION_RECONCILIATION_INGEST_PATH,
  ORGANIZATION_RECONCILIATION_ITEM_RESOLVE_PATH,
  ORGANIZATION_RECONCILIATION_RUN_BY_ID_PATH,
  ORGANIZATION_RECONCILIATION_RUN_ITEMS_PATH,
  ORGANIZATION_RECONCILIATION_RUNS_PATH,
  parallelBillingComparisonRequestSchema,
  parallelBillingComparisonResponseSchema,
  reconciliationItemResponseSchema,
  reconciliationItemsCollectionSchema,
  reconciliationRunResponseSchema,
  reconciliationRunsCollectionSchema,
  resolveReconciliationItemRequestSchema,
  type AccountingPeriodResponse,
  type AccountingPeriodsCollection,
  type CompleteReconciliationRunRequest,
  type CreateReconciliationRunRequest,
  type FinanceExportRequest,
  type FinanceExportResponse,
  type IngestSettlementsRequest,
  type InvoiceAgingResponse,
  type ParallelBillingComparisonRequest,
  type ParallelBillingComparisonResponse,
  type ReconciliationItemResponse,
  type ReconciliationItemsCollection,
  type ReconciliationRunResponse,
  type ReconciliationRunsCollection,
  type ResolveReconciliationItemRequest,
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

export async function listReconciliationRuns(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string; status?: string },
): Promise<ReconciliationRunsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_RECONCILIATION_RUNS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    status: options?.status,
  });
  const response = await authFetch(path, { method: 'GET' }, accessToken);
  return reconciliationRunsCollectionSchema.parse(await response.json());
}

export async function getReconciliationRun(
  accessToken: string,
  organizationId: string,
  runId: string,
): Promise<ReconciliationRunResponse> {
  const path = orgPath(ORGANIZATION_RECONCILIATION_RUN_BY_ID_PATH, organizationId, { runId });
  const response = await authFetch(path, { method: 'GET' }, accessToken);
  return reconciliationRunResponseSchema.parse(await response.json());
}

export async function listReconciliationItems(
  accessToken: string,
  organizationId: string,
  runId: string,
): Promise<ReconciliationItemsCollection> {
  const path = orgPath(ORGANIZATION_RECONCILIATION_RUN_ITEMS_PATH, organizationId, { runId });
  const response = await authFetch(path, { method: 'GET' }, accessToken);
  return reconciliationItemsCollectionSchema.parse(await response.json());
}

export async function createReconciliationRun(
  accessToken: string,
  organizationId: string,
  body: CreateReconciliationRunRequest,
  idempotencyKey: string,
): Promise<ReconciliationRunResponse> {
  const parsed = createReconciliationRunRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RECONCILIATION_RUNS_PATH, organizationId);
  const response = await authFetch(
    path,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      body: JSON.stringify(parsed),
    },
    accessToken,
  );
  return reconciliationRunResponseSchema.parse(await response.json());
}

export async function ingestSettlements(
  accessToken: string,
  organizationId: string,
  runId: string,
  body: IngestSettlementsRequest,
  idempotencyKey: string,
): Promise<ReconciliationRunResponse> {
  const parsed = ingestSettlementsRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RECONCILIATION_INGEST_PATH, organizationId, { runId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      body: JSON.stringify(parsed),
    },
    accessToken,
  );
  return reconciliationRunResponseSchema.parse(await response.json());
}

export async function resolveReconciliationItem(
  accessToken: string,
  organizationId: string,
  itemId: string,
  body: ResolveReconciliationItemRequest,
  idempotencyKey: string,
): Promise<ReconciliationItemResponse> {
  const parsed = resolveReconciliationItemRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RECONCILIATION_ITEM_RESOLVE_PATH, organizationId, {
    itemId,
  });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      body: JSON.stringify(parsed),
    },
    accessToken,
  );
  return reconciliationItemResponseSchema.parse(await response.json());
}

export async function completeReconciliationRun(
  accessToken: string,
  organizationId: string,
  runId: string,
  body: CompleteReconciliationRunRequest,
  idempotencyKey: string,
): Promise<ReconciliationRunResponse> {
  const parsed = completeReconciliationRunRequestSchema.parse(body ?? {});
  const path = orgPath(ORGANIZATION_RECONCILIATION_COMPLETE_PATH, organizationId, { runId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      headers: { [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
      body: JSON.stringify(parsed),
    },
    accessToken,
  );
  return reconciliationRunResponseSchema.parse(await response.json());
}

export async function getInvoiceAging(
  accessToken: string,
  organizationId: string,
  options: { asOf: string; currency: string; propertyId?: string },
): Promise<InvoiceAgingResponse> {
  const path = withQuery(orgPath(ORGANIZATION_AGING_PATH, organizationId), options);
  const response = await authFetch(path, { method: 'GET' }, accessToken);
  return invoiceAgingResponseSchema.parse(await response.json());
}

export async function listAccountingPeriods(
  accessToken: string,
  organizationId: string,
): Promise<AccountingPeriodsCollection> {
  const path = orgPath(ORGANIZATION_ACCOUNTING_PERIODS_PATH, organizationId);
  const response = await authFetch(path, { method: 'GET' }, accessToken);
  return accountingPeriodsCollectionSchema.parse(await response.json());
}

export async function closeAccountingPeriod(
  accessToken: string,
  organizationId: string,
  periodKey: string,
  reason?: string,
): Promise<AccountingPeriodResponse> {
  const path = orgPath(ORGANIZATION_ACCOUNTING_PERIOD_CLOSE_PATH, organizationId, {
    periodKey,
  });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify({ reason }) },
    accessToken,
  );
  return accountingPeriodResponseSchema.parse(await response.json());
}

export async function runParallelComparison(
  accessToken: string,
  organizationId: string,
  body: ParallelBillingComparisonRequest,
): Promise<ParallelBillingComparisonResponse> {
  const parsed = parallelBillingComparisonRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BILLING_COMPARISONS_PARALLEL_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(parsed) },
    accessToken,
  );
  return parallelBillingComparisonResponseSchema.parse(await response.json());
}

export async function exportFinance(
  accessToken: string,
  organizationId: string,
  body: FinanceExportRequest,
): Promise<FinanceExportResponse> {
  const parsed = financeExportRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_EXPORTS_FINANCE_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(parsed) },
    accessToken,
  );
  return financeExportResponseSchema.parse(await response.json());
}
