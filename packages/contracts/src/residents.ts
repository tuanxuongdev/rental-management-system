import { z } from 'zod';

import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const RESIDENT_PERMISSION_KEYS = {
  LIST: PERMISSION_KEYS.RESIDENTS_LIST,
  VIEW: PERMISSION_KEYS.RESIDENTS_VIEW,
  CREATE: PERMISSION_KEYS.RESIDENTS_CREATE,
  UPDATE: PERMISSION_KEYS.RESIDENTS_UPDATE,
  ARCHIVE: PERMISSION_KEYS.RESIDENTS_ARCHIVE,
  SENSITIVE_DATA_VIEW: PERMISSION_KEYS.RESIDENTS_SENSITIVE_DATA_VIEW,
  DO_NOT_RENT_MANAGE: PERMISSION_KEYS.RESIDENTS_DO_NOT_RENT_MANAGE,
} as const;

export const WAITLIST_PERMISSION_KEYS = {
  LIST: PERMISSION_KEYS.WAITLIST_LIST,
  VIEW: PERMISSION_KEYS.WAITLIST_VIEW,
  CREATE: PERMISSION_KEYS.WAITLIST_CREATE,
  UPDATE: PERMISSION_KEYS.WAITLIST_UPDATE,
  REMOVE: PERMISSION_KEYS.WAITLIST_REMOVE,
} as const;

export const ORGANIZATION_RESIDENTS_PATH = '/v1/organizations/{organizationId}/residents' as const;
export const ORGANIZATION_RESIDENT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/residents/{residentId}' as const;
export const ORGANIZATION_RESIDENTS_DUPLICATE_CHECK_PATH =
  '/v1/organizations/{organizationId}/residents/duplicate-check' as const;
export const ORGANIZATION_RESIDENT_DO_NOT_RENT_PATH =
  '/v1/organizations/{organizationId}/residents/{residentId}/do-not-rent' as const;
export const ORGANIZATION_WAITLIST_ENTRIES_PATH =
  '/v1/organizations/{organizationId}/waitlist-entries' as const;
export const ORGANIZATION_WAITLIST_ENTRY_BY_ID_PATH =
  '/v1/organizations/{organizationId}/waitlist-entries/{entryId}' as const;
export const ORGANIZATION_WAITLIST_ENTRY_REMOVE_PATH =
  '/v1/organizations/{organizationId}/waitlist-entries/{entryId}/remove' as const;

export const residentStatusSchema = z.enum(['PROSPECT', 'ACTIVE', 'FORMER', 'ARCHIVED']);
export type ResidentStatus = z.infer<typeof residentStatusSchema>;

export const waitlistEntryStatusSchema = z.enum([
  'OPEN',
  'OFFERED',
  'CLOSED',
  'EXPIRED',
  'REMOVED',
]);
export type WaitlistEntryStatus = z.infer<typeof waitlistEntryStatusSchema>;

export const doNotRentFlagStatusSchema = z.enum(['ACTIVE', 'CLEARED', 'EXPIRED']);
export type DoNotRentFlagStatus = z.infer<typeof doNotRentFlagStatusSchema>;

export const residentContactWriteSchema = z
  .object({
    type: z.string().min(1).max(64),
    value: z.string().min(1).max(320),
    purpose: z.string().max(100).optional(),
    isPreferred: z.boolean().optional(),
  })
  .superRefine((contact, ctx) => {
    const type = contact.type.trim().toLowerCase();
    if (type === 'email' && !z.string().email().safeParse(contact.value).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid email contact value',
        path: ['value'],
      });
    }
    if (
      (type === 'phone' || type === 'mobile' || type === 'tel') &&
      contact.value.replace(/\D/g, '').length < 7
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Invalid phone contact value',
        path: ['value'],
      });
    }
  });
export type ResidentContactWrite = z.infer<typeof residentContactWriteSchema>;

export const residentIdentifierWriteSchema = z.object({
  identifierType: z.string().min(1).max(64),
  value: z.string().min(1).max(200),
  issuer: z.string().max(100).optional(),
});
export type ResidentIdentifierWrite = z.infer<typeof residentIdentifierWriteSchema>;

export const createResidentRequestSchema = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  preferredPropertyId: z.string().uuid().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  notes: z.string().max(4000).optional(),
  status: residentStatusSchema.optional(),
  contacts: z.array(residentContactWriteSchema).optional(),
  identifiers: z.array(residentIdentifierWriteSchema).optional(),
  /** When true, create even if duplicate-check candidates exist. */
  confirmDuplicateProceed: z.boolean().optional(),
});
export type CreateResidentRequest = z.infer<typeof createResidentRequestSchema>;

export const patchResidentRequestSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  legalName: z.string().max(200).nullable().optional(),
  preferredPropertyId: z.string().uuid().nullable().optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  notes: z.string().max(4000).nullable().optional(),
  status: residentStatusSchema.optional(),
  contacts: z.array(residentContactWriteSchema).optional(),
});
export type PatchResidentRequest = z.infer<typeof patchResidentRequestSchema>;

export const residentDuplicateCheckRequestSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(3).max(40).optional(),
  identifierType: z.string().min(1).max(64).optional(),
  identifierValue: z.string().min(1).max(200).optional(),
  displayName: z.string().min(1).max(200).optional(),
  excludeResidentId: z.string().uuid().optional(),
});
export type ResidentDuplicateCheckRequest = z.infer<typeof residentDuplicateCheckRequestSchema>;

export const residentContactResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  value: z.string(),
  purpose: z.string().nullable(),
  isPreferred: z.boolean(),
});
export type ResidentContactResponse = z.infer<typeof residentContactResponseSchema>;

export const doNotRentSummarySchema = z.object({
  id: z.string().uuid(),
  status: doNotRentFlagStatusSchema,
  category: z.string(),
  reason: z.string().optional(),
  reviewAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
});
export type DoNotRentSummary = z.infer<typeof doNotRentSummarySchema>;

export const residentResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  partyId: z.string().uuid(),
  displayName: z.string(),
  legalName: z.string().nullable(),
  status: residentStatusSchema,
  preferredPropertyId: z.string().uuid().nullable(),
  dateOfBirth: z.string().nullable().optional(),
  dateOfBirthMasked: z.string().nullable(),
  notes: z.string().nullable().optional(),
  retentionClass: z.string(),
  legalHold: z.boolean(),
  version: z.number().int().positive(),
  contacts: z.array(residentContactResponseSchema).optional(),
  activeDoNotRent: doNotRentSummarySchema.nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ResidentResponse = z.infer<typeof residentResponseSchema>;

export const residentsCollectionSchema = createCursorCollectionSchema(residentResponseSchema);
export type ResidentsCollection = z.infer<typeof residentsCollectionSchema>;

export const residentDuplicateCandidateSchema = z.object({
  residentId: z.string().uuid(),
  partyId: z.string().uuid(),
  displayName: z.string(),
  matchReasons: z.array(z.string().min(1)),
});
export type ResidentDuplicateCandidate = z.infer<typeof residentDuplicateCandidateSchema>;

export const residentDuplicateCheckResponseSchema = z.object({
  candidates: z.array(residentDuplicateCandidateSchema),
  autoMerge: z.literal(false),
});
export type ResidentDuplicateCheckResponse = z.infer<typeof residentDuplicateCheckResponseSchema>;

export const setDoNotRentRequestSchema = z.object({
  reason: z.string().min(1).max(2000),
  category: z.string().min(1).max(64).optional(),
  evidenceNote: z.string().max(4000).optional(),
  reviewAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type SetDoNotRentRequest = z.infer<typeof setDoNotRentRequestSchema>;

export const clearDoNotRentRequestSchema = z.object({
  reason: z.string().min(1).max(2000),
});
export type ClearDoNotRentRequest = z.infer<typeof clearDoNotRentRequestSchema>;

export const createWaitlistEntryRequestSchema = z.object({
  partyId: z.string().uuid(),
  propertyId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(10_000).optional(),
  criteria: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(2000).optional(),
  consentAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type CreateWaitlistEntryRequest = z.infer<typeof createWaitlistEntryRequestSchema>;

export const patchWaitlistEntryRequestSchema = z.object({
  propertyId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(1).max(10_000).optional(),
  criteria: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().max(2000).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  status: waitlistEntryStatusSchema.optional(),
});
export type PatchWaitlistEntryRequest = z.infer<typeof patchWaitlistEntryRequestSchema>;

export const removeWaitlistEntryRequestSchema = z.object({
  reason: z.string().min(1).max(500),
});
export type RemoveWaitlistEntryRequest = z.infer<typeof removeWaitlistEntryRequestSchema>;

export const waitlistEntryResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  partyId: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  unitId: z.string().uuid().nullable(),
  status: waitlistEntryStatusSchema,
  priority: z.number().int(),
  criteria: z.record(z.string(), z.unknown()),
  notes: z.string().nullable(),
  consentAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  removedAt: z.string().datetime().nullable(),
  removeReason: z.string().nullable(),
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WaitlistEntryResponse = z.infer<typeof waitlistEntryResponseSchema>;

export const waitlistEntriesCollectionSchema = createCursorCollectionSchema(
  waitlistEntryResponseSchema,
);
export type WaitlistEntriesCollection = z.infer<typeof waitlistEntriesCollectionSchema>;
