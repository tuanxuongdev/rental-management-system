import { z } from 'zod';

import { createCursorCollectionSchema } from './pagination';

export const ORGANIZATION_PROPERTIES_PATH =
  '/v1/organizations/{organizationId}/properties' as const;
export const ORGANIZATION_PROPERTY_BY_ID_PATH =
  '/v1/organizations/{organizationId}/properties/{propertyId}' as const;
export const ORGANIZATION_PROPERTY_RESTORE_PATH =
  '/v1/organizations/{organizationId}/properties/{propertyId}/restore' as const;
export const ORGANIZATION_PROPERTY_BUILDINGS_PATH =
  '/v1/organizations/{organizationId}/properties/{propertyId}/buildings' as const;
export const ORGANIZATION_BUILDING_BY_ID_PATH =
  '/v1/organizations/{organizationId}/buildings/{buildingId}' as const;
export const ORGANIZATION_PROPERTY_UNITS_PATH =
  '/v1/organizations/{organizationId}/properties/{propertyId}/units' as const;
export const ORGANIZATION_UNITS_PATH =
  '/v1/organizations/{organizationId}/units' as const;
export const ORGANIZATION_UNIT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/units/{unitId}' as const;
export const ORGANIZATION_UNIT_RESTORE_PATH =
  '/v1/organizations/{organizationId}/units/{unitId}/restore' as const;
export const ORGANIZATION_UNIT_STATUS_PATH =
  '/v1/organizations/{organizationId}/units/{unitId}/status' as const;
export const ORGANIZATION_UNIT_BEDS_PATH =
  '/v1/organizations/{organizationId}/units/{unitId}/beds' as const;
export const ORGANIZATION_BED_BY_ID_PATH =
  '/v1/organizations/{organizationId}/beds/{bedId}' as const;
export const ORGANIZATION_AMENITIES_PATH = '/v1/organizations/{organizationId}/amenities' as const;
export const ORGANIZATION_PROPERTY_AMENITIES_PATH =
  '/v1/organizations/{organizationId}/properties/{propertyId}/amenities' as const;
export const ORGANIZATION_UNIT_AMENITIES_PATH =
  '/v1/organizations/{organizationId}/units/{unitId}/amenities' as const;
export const ORGANIZATION_AVAILABILITY_PATH =
  '/v1/organizations/{organizationId}/availability' as const;

export const propertyTypeSchema = z.enum(['APARTMENT', 'BOARDING_HOUSE', 'MIXED', 'OTHER']);
export const propertyStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export const unitTypeKindSchema = z.enum(['APARTMENT', 'STUDIO', 'PRIVATE_ROOM', 'SHARED_ROOM']);
export const allocationModeSchema = z.enum(['WHOLE_UNIT', 'BED', 'CAPACITY']);
export const inventoryOperationalStatusSchema = z.enum([
  'ACTIVE',
  'UNAVAILABLE',
  'UNDER_MAINTENANCE',
  'RETIRED',
]);
export const inventoryLifecycleStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);

export const createPropertyRequestSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  propertyType: propertyTypeSchema,
  addressLine1: z.string().min(1).max(200),
  addressLine2: z.string().max(200).optional(),
  city: z.string().min(1).max(100),
  region: z.string().max(100).optional(),
  postalCode: z.string().max(32).optional(),
  countryCode: z.string().length(2).default('US'),
  timeZone: z.string().min(1).max(64),
  defaultCurrency: z.string().length(3),
});

export type CreatePropertyRequest = z.infer<typeof createPropertyRequestSchema>;

export const patchPropertyRequestSchema = createPropertyRequestSchema.partial().extend({
  status: propertyStatusSchema.optional(),
});

export type PatchPropertyRequest = z.infer<typeof patchPropertyRequestSchema>;

export const restoreRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});

export type RestoreRequest = z.infer<typeof restoreRequestSchema>;

export const propertyResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  propertyType: propertyTypeSchema,
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  region: z.string().nullable(),
  postalCode: z.string().nullable(),
  countryCode: z.string(),
  timeZone: z.string(),
  defaultCurrency: z.string(),
  status: propertyStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PropertyResponse = z.infer<typeof propertyResponseSchema>;

export const propertiesCollectionSchema = createCursorCollectionSchema(propertyResponseSchema);
export type PropertiesCollection = z.infer<typeof propertiesCollectionSchema>;

export const createBuildingRequestSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
});

export type CreateBuildingRequest = z.infer<typeof createBuildingRequestSchema>;

export const patchBuildingRequestSchema = createBuildingRequestSchema.partial();

export type PatchBuildingRequest = z.infer<typeof patchBuildingRequestSchema>;

export const buildingResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  status: inventoryLifecycleStatusSchema,
  sortOrder: z.number().int(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BuildingResponse = z.infer<typeof buildingResponseSchema>;

export const buildingsCollectionSchema = createCursorCollectionSchema(buildingResponseSchema);
export type BuildingsCollection = z.infer<typeof buildingsCollectionSchema>;

export const createUnitRequestSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  unitType: unitTypeKindSchema,
  allocationMode: allocationModeSchema,
  capacity: z.number().int().min(1).default(1),
  buildingId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  unitTypeId: z.string().uuid().optional(),
});

export type CreateUnitRequest = z.infer<typeof createUnitRequestSchema>;

export const patchUnitRequestSchema = createUnitRequestSchema.partial().extend({
  status: inventoryLifecycleStatusSchema.optional(),
});

export type PatchUnitRequest = z.infer<typeof patchUnitRequestSchema>;

export const unitStatusRequestSchema = z.object({
  status: inventoryOperationalStatusSchema,
  reason: z.string().min(1).max(500),
  effectiveFrom: z.string().datetime().optional(),
});

export type UnitStatusRequest = z.infer<typeof unitStatusRequestSchema>;

export const unitResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  buildingId: z.string().uuid().nullable(),
  floorId: z.string().uuid().nullable(),
  unitTypeId: z.string().uuid().nullable(),
  code: z.string(),
  name: z.string(),
  unitType: unitTypeKindSchema,
  allocationMode: allocationModeSchema,
  capacity: z.number().int(),
  operationalStatus: inventoryOperationalStatusSchema,
  status: inventoryLifecycleStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type UnitResponse = z.infer<typeof unitResponseSchema>;

export const unitsCollectionSchema = createCursorCollectionSchema(unitResponseSchema);
export type UnitsCollection = z.infer<typeof unitsCollectionSchema>;

/** Org-wide unit list (cursor + optional filters). Property scope enforced server-side. */
export const listUnitsQuerySchema = z.object({
  after: z.string().min(1).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional(),
  propertyId: z.string().uuid().optional(),
  status: inventoryLifecycleStatusSchema.optional(),
  q: z.string().min(1).max(200).optional(),
  unitType: unitTypeKindSchema.optional(),
  operationalStatus: inventoryOperationalStatusSchema.optional(),
});

export type ListUnitsQuery = z.infer<typeof listUnitsQuerySchema>;

export const createBedRequestSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});

export type CreateBedRequest = z.infer<typeof createBedRequestSchema>;

export const patchBedRequestSchema = createBedRequestSchema.partial().extend({
  operationalStatus: inventoryOperationalStatusSchema.optional(),
  status: inventoryLifecycleStatusSchema.optional(),
});

export type PatchBedRequest = z.infer<typeof patchBedRequestSchema>;

export const bedResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  unitId: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  operationalStatus: inventoryOperationalStatusSchema,
  status: inventoryLifecycleStatusSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type BedResponse = z.infer<typeof bedResponseSchema>;

export const bedsCollectionSchema = createCursorCollectionSchema(bedResponseSchema);
export type BedsCollection = z.infer<typeof bedsCollectionSchema>;

export const createAmenityRequestSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  category: z.string().max(100).optional(),
});

export type CreateAmenityRequest = z.infer<typeof createAmenityRequestSchema>;

export const amenityResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  status: inventoryLifecycleStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AmenityResponse = z.infer<typeof amenityResponseSchema>;

export const amenitiesCollectionSchema = createCursorCollectionSchema(amenityResponseSchema);
export type AmenitiesCollection = z.infer<typeof amenitiesCollectionSchema>;

export const replaceAmenitiesRequestSchema = z.object({
  amenityIds: z.array(z.string().uuid()),
});

export type ReplaceAmenitiesRequest = z.infer<typeof replaceAmenitiesRequestSchema>;

export const availabilityQuerySchema = z.object({
  propertyId: z.string().uuid(),
  unitType: unitTypeKindSchema.optional(),
  allocationMode: allocationModeSchema.optional(),
  buildingId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  after: z.string().min(1).optional(),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const availabilityResultSchema = z.object({
  unitId: z.string().uuid(),
  bedId: z.string().uuid().nullable(),
  propertyId: z.string().uuid(),
  code: z.string(),
  granularity: z.enum(['UNIT', 'BED']),
  operationalStatus: inventoryOperationalStatusSchema,
  asOf: z.string().datetime(),
});

export type AvailabilityResult = z.infer<typeof availabilityResultSchema>;

export const availabilityCollectionSchema = createCursorCollectionSchema(availabilityResultSchema);
export type AvailabilityCollection = z.infer<typeof availabilityCollectionSchema>;
