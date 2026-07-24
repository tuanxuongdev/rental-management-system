import {
  activateLeaseRequestSchema,
  completeMoveOutRequestSchema,
  createLeaseRequestSchema,
  dashboardHomeSummarySchema,
  leaseHistoryCollectionSchema,
  leaseResponseSchema,
  leaseReviewResponseSchema,
  leasesCollectionSchema,
  moveInRequestSchema,
  occupancyEventsCollectionSchema,
  ORGANIZATION_DASHBOARD_HOME_PATH,
  ORGANIZATION_LEASE_ACTIVATE_PATH,
  ORGANIZATION_LEASE_ALLOCATIONS_PATH,
  ORGANIZATION_LEASE_BY_ID_PATH,
  ORGANIZATION_LEASE_HISTORY_PATH,
  ORGANIZATION_LEASE_MOVE_IN_PATH,
  ORGANIZATION_LEASE_MOVE_OUT_COMPLETE_PATH,
  ORGANIZATION_LEASE_MOVE_OUT_PATH,
  ORGANIZATION_LEASE_MOVE_OUT_START_PATH,
  ORGANIZATION_LEASE_OCCUPANCY_EVENTS_PATH,
  ORGANIZATION_LEASE_PENDING_ACTIONS_PATH,
  ORGANIZATION_LEASE_RENEW_PATH,
  ORGANIZATION_LEASE_REVIEW_PATH,
  ORGANIZATION_LEASE_TERMINATE_PATH,
  ORGANIZATION_LEASES_PATH,
  patchLeaseRequestSchema,
  patchMoveOutRequestSchema,
  pendingLeaseActionsResponseSchema,
  renewLeaseRequestSchema,
  setLeaseAllocationRequestSchema,
  terminateLeaseRequestSchema,
  type ActivateLeaseRequest,
  type CompleteMoveOutRequest,
  type CreateLeaseRequest,
  type DashboardHomeSummary,
  type LeaseHistoryCollection,
  type LeaseResponse,
  type LeaseReviewResponse,
  type LeasesCollection,
  type MoveInRequest,
  type OccupancyEventsCollection,
  type PatchLeaseRequest,
  type PatchMoveOutRequest,
  type PendingLeaseActionsResponse,
  type RenewLeaseRequest,
  type SetLeaseAllocationRequest,
  type TerminateLeaseRequest,
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

export type ListLeasesOptions = {
  limit?: number;
  after?: string;
  q?: string;
  status?: string;
  propertyId?: string;
  residentId?: string;
};

export async function listLeases(
  accessToken: string,
  organizationId: string,
  options?: ListLeasesOptions,
): Promise<LeasesCollection> {
  const path = withQuery(orgPath(ORGANIZATION_LEASES_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    q: options?.q,
    status: options?.status,
    propertyId: options?.propertyId,
    residentId: options?.residentId,
  });
  const response = await authFetch(path, {}, accessToken);
  return leasesCollectionSchema.parse(await response.json());
}

export async function getLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
): Promise<LeaseResponse> {
  const path = orgPath(ORGANIZATION_LEASE_BY_ID_PATH, organizationId, { leaseId });
  const response = await authFetch(path, {}, accessToken);
  return leaseResponseSchema.parse(await response.json());
}

export async function createLease(
  accessToken: string,
  organizationId: string,
  body: CreateLeaseRequest,
): Promise<LeaseResponse> {
  const parsed = createLeaseRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASES_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(parsed) },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function patchLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: PatchLeaseRequest,
  version: number,
): Promise<LeaseResponse> {
  const parsed = patchLeaseRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_BY_ID_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(parsed),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function setLeaseAllocation(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: SetLeaseAllocationRequest,
  version: number,
  idempotencyKey: string,
): Promise<LeaseResponse> {
  const parsed = setLeaseAllocationRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_ALLOCATIONS_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: {
        ...ifMatchHeaders(version),
        'Idempotency-Key': idempotencyKey,
      },
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function reviewLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
): Promise<LeaseReviewResponse> {
  const path = orgPath(ORGANIZATION_LEASE_REVIEW_PATH, organizationId, { leaseId });
  const response = await authFetch(path, { method: 'POST', body: '{}' }, accessToken);
  return leaseReviewResponseSchema.parse(await response.json());
}

export async function activateLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: ActivateLeaseRequest,
  version: number,
  idempotencyKey: string,
): Promise<LeaseResponse> {
  const parsed = activateLeaseRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_ACTIVATE_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: {
        ...ifMatchHeaders(version),
        'Idempotency-Key': idempotencyKey,
      },
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function getLeaseHistory(
  accessToken: string,
  organizationId: string,
  leaseId: string,
): Promise<LeaseHistoryCollection> {
  const path = orgPath(ORGANIZATION_LEASE_HISTORY_PATH, organizationId, { leaseId });
  const response = await authFetch(path, {}, accessToken);
  return leaseHistoryCollectionSchema.parse(await response.json());
}

export async function moveInLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: MoveInRequest,
  version: number,
  idempotencyKey: string,
): Promise<LeaseResponse> {
  const parsed = moveInRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_MOVE_IN_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function renewLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: RenewLeaseRequest,
  version: number,
): Promise<LeaseResponse> {
  const parsed = renewLeaseRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_RENEW_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function startMoveOut(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  version: number,
): Promise<LeaseResponse> {
  const path = orgPath(ORGANIZATION_LEASE_MOVE_OUT_START_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    { method: 'POST', body: '{}', headers: ifMatchHeaders(version) },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function patchMoveOut(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: PatchMoveOutRequest,
  version: number,
): Promise<LeaseResponse> {
  const parsed = patchMoveOutRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_MOVE_OUT_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(parsed),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function completeMoveOut(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: CompleteMoveOutRequest,
  version: number,
  idempotencyKey: string,
): Promise<LeaseResponse> {
  const parsed = completeMoveOutRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_MOVE_OUT_COMPLETE_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function terminateLease(
  accessToken: string,
  organizationId: string,
  leaseId: string,
  body: TerminateLeaseRequest,
  version: number,
  idempotencyKey: string,
): Promise<LeaseResponse> {
  const parsed = terminateLeaseRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_LEASE_TERMINATE_PATH, organizationId, { leaseId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(parsed),
      headers: { ...ifMatchHeaders(version), 'Idempotency-Key': idempotencyKey },
    },
    accessToken,
  );
  return leaseResponseSchema.parse(await response.json());
}

export async function listPendingLeaseActions(
  accessToken: string,
  organizationId: string,
): Promise<PendingLeaseActionsResponse> {
  const path = orgPath(ORGANIZATION_LEASE_PENDING_ACTIONS_PATH, organizationId);
  const response = await authFetch(path, {}, accessToken);
  return pendingLeaseActionsResponseSchema.parse(await response.json());
}

export async function getDashboardHome(
  accessToken: string,
  organizationId: string,
): Promise<DashboardHomeSummary> {
  const path = orgPath(ORGANIZATION_DASHBOARD_HOME_PATH, organizationId);
  const response = await authFetch(path, {}, accessToken);
  return dashboardHomeSummarySchema.parse(await response.json());
}

export async function listOccupancyEvents(
  accessToken: string,
  organizationId: string,
  leaseId: string,
): Promise<OccupancyEventsCollection> {
  const path = orgPath(ORGANIZATION_LEASE_OCCUPANCY_EVENTS_PATH, organizationId, { leaseId });
  const response = await authFetch(path, {}, accessToken);
  return occupancyEventsCollectionSchema.parse(await response.json());
}
