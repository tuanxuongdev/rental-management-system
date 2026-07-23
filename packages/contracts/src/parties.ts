import { z } from 'zod';

import { createCursorCollectionSchema } from './pagination';

export const ORGANIZATION_PROPERTY_OWNERS_PATH =
  '/v1/organizations/{organizationId}/property-owners' as const;
export const ORGANIZATION_PROPERTY_OWNER_BY_ID_PATH =
  '/v1/organizations/{organizationId}/property-owners/{ownerId}' as const;
export const ORGANIZATION_PROPERTY_OWNERSHIPS_PATH =
  '/v1/organizations/{organizationId}/properties/{propertyId}/ownerships' as const;
export const ORGANIZATION_OWNERSHIP_END_PATH =
  '/v1/organizations/{organizationId}/property-ownerships/{ownershipId}/end' as const;
export const ORGANIZATION_MANAGEMENT_AGREEMENTS_PATH =
  '/v1/organizations/{organizationId}/management-agreements' as const;
export const ORGANIZATION_MANAGEMENT_AGREEMENT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/management-agreements/{agreementId}' as const;
export const ORGANIZATION_MANAGEMENT_AGREEMENT_ACTIVATE_PATH =
  '/v1/organizations/{organizationId}/management-agreements/{agreementId}/activate' as const;
export const ORGANIZATION_MANAGEMENT_AGREEMENT_TERMINATE_PATH =
  '/v1/organizations/{organizationId}/management-agreements/{agreementId}/terminate' as const;

export const partyTypeSchema = z.enum(['PERSON', 'ORGANIZATION']);
export const partyStatusSchema = z.enum(['ACTIVE', 'ARCHIVED']);
export const ownerCategorySchema = z.enum(['INDIVIDUAL', 'COMPANY', 'TRUST', 'OTHER']);

/** Ownership and agreements never grant login/membership access. */
export const OWNERSHIP_DOES_NOT_GRANT_ACCESS = true as const;

export const createPropertyOwnerRequestSchema = z.object({
  partyType: partyTypeSchema,
  displayName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  ownerCategory: ownerCategorySchema.default('INDIVIDUAL'),
  notes: z.string().max(2000).optional(),
  contacts: z
    .array(
      z.object({
        type: z.string().min(1).max(64),
        value: z.string().min(1).max(320),
        purpose: z.string().max(100).optional(),
        isPreferred: z.boolean().optional(),
      }),
    )
    .optional(),
});

export type CreatePropertyOwnerRequest = z.infer<typeof createPropertyOwnerRequestSchema>;

export const patchPropertyOwnerRequestSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).nullable().optional(),
  ownerCategory: ownerCategorySchema.optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: partyStatusSchema.optional(),
});

export type PatchPropertyOwnerRequest = z.infer<typeof patchPropertyOwnerRequestSchema>;

export const propertyOwnerResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  partyType: partyTypeSchema,
  displayName: z.string(),
  legalName: z.string().nullable(),
  status: partyStatusSchema,
  ownerCategory: ownerCategorySchema,
  notes: z.string().nullable(),
  version: z.number().int().positive(),
  /** Explicit: Property Owner records do not create memberships or login access. */
  grantsLoginAccess: z.literal(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PropertyOwnerResponse = z.infer<typeof propertyOwnerResponseSchema>;

export const propertyOwnersCollectionSchema = createCursorCollectionSchema(
  propertyOwnerResponseSchema,
);
export type PropertyOwnersCollection = z.infer<typeof propertyOwnersCollectionSchema>;

export const createOwnershipRequestSchema = z.object({
  ownerPartyId: z.string().uuid(),
  interestType: z.string().min(1).max(64).default('EQUITY'),
  ownershipPercentage: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/)
    .optional(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
});

export type CreateOwnershipRequest = z.infer<typeof createOwnershipRequestSchema>;

export const endOwnershipRequestSchema = z.object({
  effectiveTo: z.string().datetime(),
  reason: z.string().min(1).max(500),
});

export type EndOwnershipRequest = z.infer<typeof endOwnershipRequestSchema>;

export const propertyOwnershipResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  ownerPartyId: z.string().uuid(),
  interestType: z.string(),
  ownershipPercentage: z.string().nullable(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  status: z.string(),
  version: z.number().int().positive(),
  grantsLoginAccess: z.literal(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PropertyOwnershipResponse = z.infer<typeof propertyOwnershipResponseSchema>;

export const propertyOwnershipsCollectionSchema = createCursorCollectionSchema(
  propertyOwnershipResponseSchema,
);
export type PropertyOwnershipsCollection = z.infer<typeof propertyOwnershipsCollectionSchema>;

export const createManagementAgreementRequestSchema = z.object({
  propertyId: z.string().uuid(),
  agreementNumber: z.string().min(1).max(64),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
  partyIds: z.array(z.string().uuid()).optional(),
});

export type CreateManagementAgreementRequest = z.infer<
  typeof createManagementAgreementRequestSchema
>;

export const patchManagementAgreementRequestSchema = z.object({
  agreementNumber: z.string().min(1).max(64).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export type PatchManagementAgreementRequest = z.infer<typeof patchManagementAgreementRequestSchema>;

export const activateAgreementRequestSchema = z.object({
  effectiveFrom: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export type ActivateAgreementRequest = z.infer<typeof activateAgreementRequestSchema>;

export const terminateAgreementRequestSchema = z.object({
  effectiveTo: z.string().datetime(),
  reason: z.string().min(1).max(500),
});

export type TerminateAgreementRequest = z.infer<typeof terminateAgreementRequestSchema>;

export const managementAgreementResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  agreementNumber: z.string(),
  status: z.string(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  notes: z.string().nullable(),
  version: z.number().int().positive(),
  /** Explicit: management agreements do not create memberships or login access. */
  grantsLoginAccess: z.literal(false),
  partyIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ManagementAgreementResponse = z.infer<typeof managementAgreementResponseSchema>;

export const managementAgreementsCollectionSchema = createCursorCollectionSchema(
  managementAgreementResponseSchema,
);
export type ManagementAgreementsCollection = z.infer<typeof managementAgreementsCollectionSchema>;
