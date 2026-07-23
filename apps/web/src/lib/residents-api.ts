import {
  ORGANIZATION_RESIDENT_BY_ID_PATH,
  ORGANIZATION_RESIDENT_DO_NOT_RENT_PATH,
  ORGANIZATION_RESIDENTS_DUPLICATE_CHECK_PATH,
  ORGANIZATION_RESIDENTS_PATH,
  ORGANIZATION_WAITLIST_ENTRIES_PATH,
  ORGANIZATION_WAITLIST_ENTRY_BY_ID_PATH,
  ORGANIZATION_WAITLIST_ENTRY_REMOVE_PATH,
  clearDoNotRentRequestSchema,
  createResidentRequestSchema,
  createWaitlistEntryRequestSchema,
  doNotRentSummarySchema,
  patchResidentRequestSchema,
  patchWaitlistEntryRequestSchema,
  removeWaitlistEntryRequestSchema,
  residentDuplicateCheckRequestSchema,
  residentDuplicateCheckResponseSchema,
  residentResponseSchema,
  residentsCollectionSchema,
  setDoNotRentRequestSchema,
  waitlistEntriesCollectionSchema,
  waitlistEntryResponseSchema,
  type ClearDoNotRentRequest,
  type CreateResidentRequest,
  type CreateWaitlistEntryRequest,
  type DoNotRentSummary,
  type PatchResidentRequest,
  type PatchWaitlistEntryRequest,
  type RemoveWaitlistEntryRequest,
  type ResidentDuplicateCheckRequest,
  type ResidentDuplicateCheckResponse,
  type ResidentResponse,
  type ResidentsCollection,
  type SetDoNotRentRequest,
  type WaitlistEntriesCollection,
  type WaitlistEntryResponse,
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

export type ListResidentsOptions = {
  limit?: number;
  after?: string;
  q?: string;
  status?: string;
  propertyId?: string;
};

export type ListWaitlistOptions = {
  limit?: number;
  after?: string;
  q?: string;
  status?: string;
  propertyId?: string;
  partyId?: string;
};

export async function listResidents(
  accessToken: string,
  organizationId: string,
  options?: ListResidentsOptions,
): Promise<ResidentsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_RESIDENTS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    q: options?.q,
    status: options?.status,
    preferredPropertyId: options?.propertyId,
  });
  const response = await authFetch(path, {}, accessToken);
  return residentsCollectionSchema.parse(await response.json());
}

export async function getResident(
  accessToken: string,
  organizationId: string,
  residentId: string,
): Promise<ResidentResponse> {
  const path = orgPath(ORGANIZATION_RESIDENT_BY_ID_PATH, organizationId, { residentId });
  const response = await authFetch(path, {}, accessToken);
  return residentResponseSchema.parse(await response.json());
}

export async function createResident(
  accessToken: string,
  organizationId: string,
  body: CreateResidentRequest,
): Promise<ResidentResponse> {
  createResidentRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RESIDENTS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return residentResponseSchema.parse(await response.json());
}

export async function patchResident(
  accessToken: string,
  organizationId: string,
  residentId: string,
  body: PatchResidentRequest,
  version?: number,
): Promise<ResidentResponse> {
  patchResidentRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RESIDENT_BY_ID_PATH, organizationId, { residentId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return residentResponseSchema.parse(await response.json());
}

export async function checkResidentDuplicates(
  accessToken: string,
  organizationId: string,
  body: ResidentDuplicateCheckRequest,
): Promise<ResidentDuplicateCheckResponse> {
  residentDuplicateCheckRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RESIDENTS_DUPLICATE_CHECK_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return residentDuplicateCheckResponseSchema.parse(await response.json());
}

export async function setDoNotRent(
  accessToken: string,
  organizationId: string,
  residentId: string,
  body: SetDoNotRentRequest,
): Promise<DoNotRentSummary> {
  setDoNotRentRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RESIDENT_DO_NOT_RENT_PATH, organizationId, { residentId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return doNotRentSummarySchema.parse(await response.json());
}

export async function clearDoNotRent(
  accessToken: string,
  organizationId: string,
  residentId: string,
  body: ClearDoNotRentRequest,
): Promise<DoNotRentSummary> {
  clearDoNotRentRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_RESIDENT_DO_NOT_RENT_PATH, organizationId, { residentId });
  const response = await authFetch(
    path,
    { method: 'DELETE', body: JSON.stringify(body) },
    accessToken,
  );
  return doNotRentSummarySchema.parse(await response.json());
}

export async function listWaitlistEntries(
  accessToken: string,
  organizationId: string,
  options?: ListWaitlistOptions,
): Promise<WaitlistEntriesCollection> {
  const path = withQuery(orgPath(ORGANIZATION_WAITLIST_ENTRIES_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    q: options?.q,
    status: options?.status,
    propertyId: options?.propertyId,
    partyId: options?.partyId,
  });
  const response = await authFetch(path, {}, accessToken);
  return waitlistEntriesCollectionSchema.parse(await response.json());
}

export async function createWaitlistEntry(
  accessToken: string,
  organizationId: string,
  body: CreateWaitlistEntryRequest,
): Promise<WaitlistEntryResponse> {
  createWaitlistEntryRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_WAITLIST_ENTRIES_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return waitlistEntryResponseSchema.parse(await response.json());
}

export async function patchWaitlistEntry(
  accessToken: string,
  organizationId: string,
  entryId: string,
  body: PatchWaitlistEntryRequest,
  version?: number,
): Promise<WaitlistEntryResponse> {
  patchWaitlistEntryRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_WAITLIST_ENTRY_BY_ID_PATH, organizationId, { entryId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return waitlistEntryResponseSchema.parse(await response.json());
}

export async function removeWaitlistEntry(
  accessToken: string,
  organizationId: string,
  entryId: string,
  body: RemoveWaitlistEntryRequest,
): Promise<WaitlistEntryResponse> {
  removeWaitlistEntryRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_WAITLIST_ENTRY_REMOVE_PATH, organizationId, { entryId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return waitlistEntryResponseSchema.parse(await response.json());
}
