import {
  ORGANIZATION_AVAILABILITY_PATH,
  ORGANIZATION_BED_BY_ID_PATH,
  ORGANIZATION_BUILDING_BY_ID_PATH,
  ORGANIZATION_MANAGEMENT_AGREEMENT_ACTIVATE_PATH,
  ORGANIZATION_MANAGEMENT_AGREEMENT_BY_ID_PATH,
  ORGANIZATION_MANAGEMENT_AGREEMENT_TERMINATE_PATH,
  ORGANIZATION_MANAGEMENT_AGREEMENTS_PATH,
  ORGANIZATION_OWNERSHIP_END_PATH,
  ORGANIZATION_PROPERTIES_PATH,
  ORGANIZATION_PROPERTY_BUILDINGS_PATH,
  ORGANIZATION_PROPERTY_BY_ID_PATH,
  ORGANIZATION_PROPERTY_OWNER_BY_ID_PATH,
  ORGANIZATION_PROPERTY_OWNERS_PATH,
  ORGANIZATION_PROPERTY_OWNERSHIPS_PATH,
  ORGANIZATION_PROPERTY_UNITS_PATH,
  ORGANIZATION_UNITS_PATH,
  ORGANIZATION_UNIT_BEDS_PATH,
  ORGANIZATION_UNIT_BY_ID_PATH,
  ORGANIZATION_UNIT_STATUS_PATH,
  activateAgreementRequestSchema,
  availabilityCollectionSchema,
  bedsCollectionSchema,
  bedResponseSchema,
  buildingsCollectionSchema,
  buildingResponseSchema,
  createBedRequestSchema,
  createBuildingRequestSchema,
  createManagementAgreementRequestSchema,
  createOwnershipRequestSchema,
  createPropertyOwnerRequestSchema,
  createPropertyRequestSchema,
  createUnitRequestSchema,
  endOwnershipRequestSchema,
  managementAgreementResponseSchema,
  managementAgreementsCollectionSchema,
  patchBedRequestSchema,
  patchBuildingRequestSchema,
  patchManagementAgreementRequestSchema,
  patchPropertyOwnerRequestSchema,
  patchPropertyRequestSchema,
  patchUnitRequestSchema,
  propertiesCollectionSchema,
  propertyOwnerResponseSchema,
  propertyOwnersCollectionSchema,
  propertyOwnershipResponseSchema,
  propertyOwnershipsCollectionSchema,
  propertyResponseSchema,
  terminateAgreementRequestSchema,
  unitResponseSchema,
  unitsCollectionSchema,
  unitStatusRequestSchema,
  type ActivateAgreementRequest,
  type AvailabilityCollection,
  type AvailabilityQuery,
  type BedResponse,
  type BedsCollection,
  type BuildingResponse,
  type BuildingsCollection,
  type CreateBedRequest,
  type CreateBuildingRequest,
  type CreateManagementAgreementRequest,
  type CreateOwnershipRequest,
  type CreatePropertyOwnerRequest,
  type CreatePropertyRequest,
  type CreateUnitRequest,
  type EndOwnershipRequest,
  type ManagementAgreementResponse,
  type ManagementAgreementsCollection,
  type PatchBedRequest,
  type PatchBuildingRequest,
  type PatchManagementAgreementRequest,
  type PatchPropertyOwnerRequest,
  type PatchPropertyRequest,
  type PatchUnitRequest,
  type PropertiesCollection,
  type PropertyOwnerResponse,
  type PropertyOwnersCollection,
  type PropertyOwnershipResponse,
  type PropertyOwnershipsCollection,
  type PropertyResponse,
  type TerminateAgreementRequest,
  type UnitResponse,
  type UnitsCollection,
  type UnitStatusRequest,
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

type CursorOptions = { limit?: number; after?: string };

// —— Properties ——

export async function listProperties(
  accessToken: string,
  organizationId: string,
  options?: CursorOptions & { q?: string; status?: string },
): Promise<PropertiesCollection> {
  const path = withQuery(orgPath(ORGANIZATION_PROPERTIES_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    q: options?.q,
    status: options?.status,
  });
  const response = await authFetch(path, {}, accessToken);
  return propertiesCollectionSchema.parse(await response.json());
}

export async function getProperty(
  accessToken: string,
  organizationId: string,
  propertyId: string,
): Promise<PropertyResponse> {
  const path = orgPath(ORGANIZATION_PROPERTY_BY_ID_PATH, organizationId, { propertyId });
  const response = await authFetch(path, {}, accessToken);
  return propertyResponseSchema.parse(await response.json());
}

export async function createProperty(
  accessToken: string,
  organizationId: string,
  body: CreatePropertyRequest,
): Promise<PropertyResponse> {
  createPropertyRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTIES_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return propertyResponseSchema.parse(await response.json());
}

export async function patchProperty(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  body: PatchPropertyRequest,
  version?: number,
): Promise<PropertyResponse> {
  patchPropertyRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTY_BY_ID_PATH, organizationId, { propertyId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return propertyResponseSchema.parse(await response.json());
}

export async function archiveProperty(
  accessToken: string,
  organizationId: string,
  propertyId: string,
): Promise<void> {
  const path = orgPath(ORGANIZATION_PROPERTY_BY_ID_PATH, organizationId, { propertyId });
  await authFetch(path, { method: 'DELETE' }, accessToken);
}

// —— Buildings ——

export async function listBuildings(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  options?: CursorOptions,
): Promise<BuildingsCollection> {
  const path = withQuery(
    orgPath(ORGANIZATION_PROPERTY_BUILDINGS_PATH, organizationId, { propertyId }),
    { limit: options?.limit, after: options?.after },
  );
  const response = await authFetch(path, {}, accessToken);
  return buildingsCollectionSchema.parse(await response.json());
}

export async function createBuilding(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  body: CreateBuildingRequest,
): Promise<BuildingResponse> {
  createBuildingRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTY_BUILDINGS_PATH, organizationId, { propertyId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return buildingResponseSchema.parse(await response.json());
}

export async function patchBuilding(
  accessToken: string,
  organizationId: string,
  buildingId: string,
  body: PatchBuildingRequest,
  version?: number,
): Promise<BuildingResponse> {
  patchBuildingRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BUILDING_BY_ID_PATH, organizationId, { buildingId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return buildingResponseSchema.parse(await response.json());
}

// —— Units ——

export async function listUnitsOrg(
  accessToken: string,
  organizationId: string,
  options?: CursorOptions & {
    propertyId?: string;
    status?: string;
    q?: string;
    unitType?: string;
    operationalStatus?: string;
  },
): Promise<UnitsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_UNITS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    propertyId: options?.propertyId,
    status: options?.status,
    q: options?.q,
    unitType: options?.unitType,
    operationalStatus: options?.operationalStatus,
  });
  const response = await authFetch(path, {}, accessToken);
  return unitsCollectionSchema.parse(await response.json());
}

export async function listUnits(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  options?: CursorOptions & { status?: string; buildingId?: string; q?: string },
): Promise<UnitsCollection> {
  const path = withQuery(
    orgPath(ORGANIZATION_PROPERTY_UNITS_PATH, organizationId, { propertyId }),
    {
      limit: options?.limit,
      after: options?.after,
      status: options?.status,
      buildingId: options?.buildingId,
      q: options?.q,
    },
  );
  const response = await authFetch(path, {}, accessToken);
  return unitsCollectionSchema.parse(await response.json());
}

export async function getUnit(
  accessToken: string,
  organizationId: string,
  unitId: string,
): Promise<UnitResponse> {
  const path = orgPath(ORGANIZATION_UNIT_BY_ID_PATH, organizationId, { unitId });
  const response = await authFetch(path, {}, accessToken);
  return unitResponseSchema.parse(await response.json());
}

export async function createUnit(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  body: CreateUnitRequest,
): Promise<UnitResponse> {
  createUnitRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTY_UNITS_PATH, organizationId, { propertyId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return unitResponseSchema.parse(await response.json());
}

export async function patchUnit(
  accessToken: string,
  organizationId: string,
  unitId: string,
  body: PatchUnitRequest,
  version?: number,
): Promise<UnitResponse> {
  patchUnitRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_UNIT_BY_ID_PATH, organizationId, { unitId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return unitResponseSchema.parse(await response.json());
}

export async function archiveUnit(
  accessToken: string,
  organizationId: string,
  unitId: string,
): Promise<void> {
  const path = orgPath(ORGANIZATION_UNIT_BY_ID_PATH, organizationId, { unitId });
  await authFetch(path, { method: 'DELETE' }, accessToken);
}

export async function updateUnitOperationalStatus(
  accessToken: string,
  organizationId: string,
  unitId: string,
  body: UnitStatusRequest,
  version?: number,
): Promise<UnitResponse> {
  unitStatusRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_UNIT_STATUS_PATH, organizationId, { unitId });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return unitResponseSchema.parse(await response.json());
}

// —— Beds ——

export async function listBeds(
  accessToken: string,
  organizationId: string,
  unitId: string,
  options?: CursorOptions,
): Promise<BedsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_UNIT_BEDS_PATH, organizationId, { unitId }), {
    limit: options?.limit,
    after: options?.after,
  });
  const response = await authFetch(path, {}, accessToken);
  return bedsCollectionSchema.parse(await response.json());
}

export async function createBed(
  accessToken: string,
  organizationId: string,
  unitId: string,
  body: CreateBedRequest,
): Promise<BedResponse> {
  createBedRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_UNIT_BEDS_PATH, organizationId, { unitId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return bedResponseSchema.parse(await response.json());
}

export async function patchBed(
  accessToken: string,
  organizationId: string,
  bedId: string,
  body: PatchBedRequest,
  version?: number,
): Promise<BedResponse> {
  patchBedRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_BED_BY_ID_PATH, organizationId, { bedId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return bedResponseSchema.parse(await response.json());
}

// —— Availability ——

export async function lookupAvailability(
  accessToken: string,
  organizationId: string,
  query: AvailabilityQuery,
): Promise<AvailabilityCollection> {
  const path = withQuery(orgPath(ORGANIZATION_AVAILABILITY_PATH, organizationId), {
    propertyId: query.propertyId,
    unitType: query.unitType,
    allocationMode: query.allocationMode,
    buildingId: query.buildingId,
    limit: query.limit,
    after: query.after,
  });
  const response = await authFetch(path, {}, accessToken);
  return availabilityCollectionSchema.parse(await response.json());
}

// —— Property owners ——

export async function listPropertyOwners(
  accessToken: string,
  organizationId: string,
  options?: CursorOptions & { q?: string },
): Promise<PropertyOwnersCollection> {
  const path = withQuery(orgPath(ORGANIZATION_PROPERTY_OWNERS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    q: options?.q,
  });
  const response = await authFetch(path, {}, accessToken);
  return propertyOwnersCollectionSchema.parse(await response.json());
}

export async function getPropertyOwner(
  accessToken: string,
  organizationId: string,
  ownerId: string,
): Promise<PropertyOwnerResponse> {
  const path = orgPath(ORGANIZATION_PROPERTY_OWNER_BY_ID_PATH, organizationId, { ownerId });
  const response = await authFetch(path, {}, accessToken);
  return propertyOwnerResponseSchema.parse(await response.json());
}

export async function createPropertyOwner(
  accessToken: string,
  organizationId: string,
  body: CreatePropertyOwnerRequest,
): Promise<PropertyOwnerResponse> {
  createPropertyOwnerRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTY_OWNERS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return propertyOwnerResponseSchema.parse(await response.json());
}

export async function patchPropertyOwner(
  accessToken: string,
  organizationId: string,
  ownerId: string,
  body: PatchPropertyOwnerRequest,
  version?: number,
): Promise<PropertyOwnerResponse> {
  patchPropertyOwnerRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTY_OWNER_BY_ID_PATH, organizationId, { ownerId });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return propertyOwnerResponseSchema.parse(await response.json());
}

// —— Ownerships ——

export async function listOwnerships(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  options?: CursorOptions,
): Promise<PropertyOwnershipsCollection> {
  const path = withQuery(
    orgPath(ORGANIZATION_PROPERTY_OWNERSHIPS_PATH, organizationId, { propertyId }),
    { limit: options?.limit, after: options?.after },
  );
  const response = await authFetch(path, {}, accessToken);
  return propertyOwnershipsCollectionSchema.parse(await response.json());
}

export async function createOwnership(
  accessToken: string,
  organizationId: string,
  propertyId: string,
  body: CreateOwnershipRequest,
): Promise<PropertyOwnershipResponse> {
  createOwnershipRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_PROPERTY_OWNERSHIPS_PATH, organizationId, { propertyId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return propertyOwnershipResponseSchema.parse(await response.json());
}

export async function endOwnership(
  accessToken: string,
  organizationId: string,
  ownershipId: string,
  body: EndOwnershipRequest,
): Promise<PropertyOwnershipResponse> {
  endOwnershipRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_OWNERSHIP_END_PATH, organizationId, { ownershipId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return propertyOwnershipResponseSchema.parse(await response.json());
}

// —— Management agreements ——

export async function listManagementAgreements(
  accessToken: string,
  organizationId: string,
  options?: CursorOptions & { propertyId?: string },
): Promise<ManagementAgreementsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_MANAGEMENT_AGREEMENTS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    propertyId: options?.propertyId,
  });
  const response = await authFetch(path, {}, accessToken);
  return managementAgreementsCollectionSchema.parse(await response.json());
}

export async function getManagementAgreement(
  accessToken: string,
  organizationId: string,
  agreementId: string,
): Promise<ManagementAgreementResponse> {
  const path = orgPath(ORGANIZATION_MANAGEMENT_AGREEMENT_BY_ID_PATH, organizationId, {
    agreementId,
  });
  const response = await authFetch(path, {}, accessToken);
  return managementAgreementResponseSchema.parse(await response.json());
}

export async function createManagementAgreement(
  accessToken: string,
  organizationId: string,
  body: CreateManagementAgreementRequest,
): Promise<ManagementAgreementResponse> {
  createManagementAgreementRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MANAGEMENT_AGREEMENTS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return managementAgreementResponseSchema.parse(await response.json());
}

export async function patchManagementAgreement(
  accessToken: string,
  organizationId: string,
  agreementId: string,
  body: PatchManagementAgreementRequest,
  version?: number,
): Promise<ManagementAgreementResponse> {
  patchManagementAgreementRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MANAGEMENT_AGREEMENT_BY_ID_PATH, organizationId, {
    agreementId,
  });
  const response = await authFetch(
    path,
    {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return managementAgreementResponseSchema.parse(await response.json());
}

export async function activateManagementAgreement(
  accessToken: string,
  organizationId: string,
  agreementId: string,
  body: ActivateAgreementRequest = {},
  version?: number,
): Promise<ManagementAgreementResponse> {
  activateAgreementRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MANAGEMENT_AGREEMENT_ACTIVATE_PATH, organizationId, {
    agreementId,
  });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return managementAgreementResponseSchema.parse(await response.json());
}

export async function terminateManagementAgreement(
  accessToken: string,
  organizationId: string,
  agreementId: string,
  body: TerminateAgreementRequest,
  version?: number,
): Promise<ManagementAgreementResponse> {
  terminateAgreementRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_MANAGEMENT_AGREEMENT_TERMINATE_PATH, organizationId, {
    agreementId,
  });
  const response = await authFetch(
    path,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: ifMatchHeaders(version),
    },
    accessToken,
  );
  return managementAgreementResponseSchema.parse(await response.json());
}
