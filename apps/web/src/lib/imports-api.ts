import {
  ORGANIZATION_EXPORTS_PATH,
  ORGANIZATION_IMPORTS_PATH,
  ORGANIZATION_IMPORT_BY_ID_PATH,
  ORGANIZATION_IMPORT_COMMIT_PATH,
  ORGANIZATION_IMPORT_DRY_RUN_PATH,
  ORGANIZATION_IMPORT_ERRORS_PATH,
  ORGANIZATION_IMPORT_TEMPLATE_INVENTORY_PATH,
  ORGANIZATION_OPERATIONS_PATH,
  ORGANIZATION_UNITS_BULK_STATUS_PATH,
  bulkUnitStatusRequestSchema,
  bulkUnitStatusResponseSchema,
  createExportRequestSchema,
  createImportRequestSchema,
  dryRunSummarySchema,
  exportJobResponseSchema,
  importJobResponseSchema,
  operationsJobsCollectionSchema,
  type BulkUnitStatusRequest,
  type BulkUnitStatusResponse,
  type CreateExportRequest,
  type CreateImportRequest,
  type DryRunSummary,
  type ExportJobResponse,
  type ImportJobResponse,
  type OperationsJobsCollection,
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

function withCursorQuery(path: string, options?: { limit?: number; after?: string }): string {
  const params = new URLSearchParams();
  if (options?.limit !== undefined) {
    params.set('limit', String(options.limit));
  }
  if (options?.after !== undefined) {
    params.set('after', options.after);
  }
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export async function getInventoryTemplate(
  accessToken: string,
  organizationId: string,
): Promise<string> {
  const path = orgPath(ORGANIZATION_IMPORT_TEMPLATE_INVENTORY_PATH, organizationId);
  const response = await authFetch(path, {}, accessToken);
  return response.text();
}

export async function createImport(
  accessToken: string,
  organizationId: string,
  body: CreateImportRequest,
): Promise<ImportJobResponse> {
  createImportRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_IMPORTS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return importJobResponseSchema.parse(await response.json());
}

export async function dryRunImport(
  accessToken: string,
  organizationId: string,
  importId: string,
): Promise<DryRunSummary> {
  const path = orgPath(ORGANIZATION_IMPORT_DRY_RUN_PATH, organizationId, { importId });
  const response = await authFetch(path, { method: 'POST' }, accessToken);
  return dryRunSummarySchema.parse(await response.json());
}

export async function commitImport(
  accessToken: string,
  organizationId: string,
  importId: string,
  idempotencyKey: string,
): Promise<ImportJobResponse> {
  const path = orgPath(ORGANIZATION_IMPORT_COMMIT_PATH, organizationId, { importId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return importJobResponseSchema.parse(await response.json());
}

export async function getImport(
  accessToken: string,
  organizationId: string,
  importId: string,
): Promise<ImportJobResponse> {
  const path = orgPath(ORGANIZATION_IMPORT_BY_ID_PATH, organizationId, { importId });
  const response = await authFetch(path, {}, accessToken);
  return importJobResponseSchema.parse(await response.json());
}

export async function getImportErrors(
  accessToken: string,
  organizationId: string,
  importId: string,
): Promise<string> {
  const path = orgPath(ORGANIZATION_IMPORT_ERRORS_PATH, organizationId, { importId });
  const response = await authFetch(path, {}, accessToken);
  return response.text();
}

export async function bulkUnitStatus(
  accessToken: string,
  organizationId: string,
  body: BulkUnitStatusRequest,
): Promise<BulkUnitStatusResponse> {
  bulkUnitStatusRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_UNITS_BULK_STATUS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return bulkUnitStatusResponseSchema.parse(await response.json());
}

export async function listOperations(
  accessToken: string,
  organizationId: string,
  options?: { limit?: number; after?: string },
): Promise<OperationsJobsCollection> {
  const path = withCursorQuery(orgPath(ORGANIZATION_OPERATIONS_PATH, organizationId), options);
  const response = await authFetch(path, {}, accessToken);
  return operationsJobsCollectionSchema.parse(await response.json());
}

export async function createExport(
  accessToken: string,
  organizationId: string,
  body: Partial<CreateExportRequest> = {},
): Promise<ExportJobResponse> {
  const parsed = createExportRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_EXPORTS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(parsed) },
    accessToken,
  );
  return exportJobResponseSchema.parse(await response.json());
}
