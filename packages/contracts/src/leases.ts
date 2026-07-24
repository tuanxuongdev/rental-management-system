import { z } from 'zod';

import { moneyAmountStringSchema, currencyCodeSchema } from './money';
import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const LEASE_PERMISSION_KEYS = {
  LIST: PERMISSION_KEYS.LEASES_LIST,
  VIEW: PERMISSION_KEYS.LEASES_VIEW,
  CREATE: PERMISSION_KEYS.LEASES_CREATE,
  UPDATE: PERMISSION_KEYS.LEASES_UPDATE,
  ACTIVATE: PERMISSION_KEYS.LEASES_ACTIVATE,
  OVERRIDE_DO_NOT_RENT: PERMISSION_KEYS.LEASES_OVERRIDE_DO_NOT_RENT,
  MOVE_IN: PERMISSION_KEYS.LEASES_MOVE_IN,
  RENEW: PERMISSION_KEYS.LEASES_RENEW,
  TRANSFER: PERMISSION_KEYS.LEASES_TRANSFER,
  MOVE_OUT: PERMISSION_KEYS.LEASES_MOVE_OUT,
  TERMINATE: PERMISSION_KEYS.LEASES_TERMINATE,
} as const;

export const ORGANIZATION_LEASES_PATH = '/v1/organizations/{organizationId}/leases' as const;
export const ORGANIZATION_LEASE_BY_ID_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}' as const;
export const ORGANIZATION_LEASE_ALLOCATIONS_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/allocations' as const;
export const ORGANIZATION_LEASE_REVIEW_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/review' as const;
export const ORGANIZATION_LEASE_ACTIVATE_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/activate' as const;
export const ORGANIZATION_LEASE_HISTORY_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/history' as const;

export const LEASE_ACTIVATED_EVENT_TYPE = 'lease.activated' as const;

export const leaseStatusSchema = z.enum(['DRAFT', 'ACTIVE', 'NOTICE', 'ENDED', 'CANCELLED']);
export type LeaseStatus = z.infer<typeof leaseStatusSchema>;

export const leasePartyRoleSchema = z.enum([
  'PRIMARY_LEASEHOLDER',
  'LEASEHOLDER',
  'OCCUPANT',
  'GUARANTOR',
  'PAYER',
  'SPONSOR',
]);
export type LeasePartyRole = z.infer<typeof leasePartyRoleSchema>;

export const leaseAllocationTypeSchema = z.enum(['WHOLE_UNIT', 'BED', 'CAPACITY']);
export type LeaseAllocationType = z.infer<typeof leaseAllocationTypeSchema>;

export const leaseAllocationStatusSchema = z.enum(['ACTIVE', 'ENDED', 'CANCELLED']);
export type LeaseAllocationStatus = z.infer<typeof leaseAllocationStatusSchema>;

export const rentCadenceSchema = z.enum(['MONTHLY', 'WEEKLY', 'DAILY', 'OTHER']);
export type RentCadence = z.infer<typeof rentCadenceSchema>;

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const recurringChargeInputSchema = z.object({
  code: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  amount: moneyAmountStringSchema,
  cadence: rentCadenceSchema.optional(),
});
export type RecurringChargeInput = z.infer<typeof recurringChargeInputSchema>;

export const leasePartyWriteSchema = z.object({
  partyId: z.string().uuid(),
  role: leasePartyRoleSchema.default('PRIMARY_LEASEHOLDER'),
  isPrimary: z.boolean().optional(),
});
export type LeasePartyWrite = z.infer<typeof leasePartyWriteSchema>;

export const leaseAllocationWriteSchema = z
  .object({
    unitId: z.string().uuid(),
    bedId: z.string().uuid().optional(),
    allocationType: leaseAllocationTypeSchema,
    capacityQuantity: z.number().int().positive().max(1000).optional(),
    effectiveFrom: z.string().datetime().optional(),
    effectiveTo: z.string().datetime().nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.allocationType === 'BED' && value.bedId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bedId is required for BED allocation',
        path: ['bedId'],
      });
    }
    if (value.allocationType !== 'BED' && value.bedId !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'bedId is only valid for BED allocation',
        path: ['bedId'],
      });
    }
    if (value.allocationType === 'CAPACITY' && (value.capacityQuantity ?? 1) < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'capacityQuantity must be >= 1 for CAPACITY allocation',
        path: ['capacityQuantity'],
      });
    }
  });
export type LeaseAllocationWrite = z.infer<typeof leaseAllocationWriteSchema>;

export const createLeaseRequestSchema = z
  .object({
    propertyId: z.string().uuid(),
    currency: currencyCodeSchema,
    startDate: dateOnlySchema,
    endDate: dateOnlySchema.nullable().optional(),
    notes: z.string().max(4000).optional(),
    rentAmount: moneyAmountStringSchema,
    depositAmount: moneyAmountStringSchema,
    rentCadence: rentCadenceSchema.optional(),
    recurringCharges: z.array(recurringChargeInputSchema).max(20).optional(),
    parties: z.array(leasePartyWriteSchema).min(1),
    allocation: leaseAllocationWriteSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate !== undefined && value.endDate !== null && value.endDate <= value.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endDate must be after startDate',
        path: ['endDate'],
      });
    }
    const primaries = value.parties.filter(
      (party) => party.isPrimary === true || party.role === 'PRIMARY_LEASEHOLDER',
    );
    if (primaries.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one primary leaseholder is required',
        path: ['parties'],
      });
    }
  });
export type CreateLeaseRequest = z.infer<typeof createLeaseRequestSchema>;

export const patchLeaseRequestSchema = z
  .object({
    startDate: dateOnlySchema.optional(),
    endDate: dateOnlySchema.nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    currency: currencyCodeSchema.optional(),
    rentAmount: moneyAmountStringSchema.optional(),
    depositAmount: moneyAmountStringSchema.optional(),
    rentCadence: rentCadenceSchema.optional(),
    recurringCharges: z.array(recurringChargeInputSchema).max(20).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });
export type PatchLeaseRequest = z.infer<typeof patchLeaseRequestSchema>;

export const setLeaseAllocationRequestSchema = leaseAllocationWriteSchema;
export type SetLeaseAllocationRequest = z.infer<typeof setLeaseAllocationRequestSchema>;

export const activateLeaseRequestSchema = z
  .object({
    effectiveAt: z.string().datetime().optional(),
    overrideDoNotRent: z.boolean().optional(),
    overrideReason: z.string().min(3).max(1000).optional(),
    checklistAcknowledged: z.literal(true),
  })
  .superRefine((value, ctx) => {
    if (value.overrideDoNotRent === true) {
      const reason = value.overrideReason?.trim() ?? '';
      if (reason.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'overrideReason is required when overrideDoNotRent is true',
          path: ['overrideReason'],
        });
      }
    }
  });
export type ActivateLeaseRequest = z.infer<typeof activateLeaseRequestSchema>;

export const leasePartyResponseSchema = z.object({
  id: z.string().uuid(),
  partyId: z.string().uuid(),
  displayName: z.string().optional(),
  role: leasePartyRoleSchema,
  isPrimary: z.boolean(),
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
});
export type LeasePartyResponse = z.infer<typeof leasePartyResponseSchema>;

export const leaseTermResponseSchema = z.object({
  id: z.string().uuid(),
  versionNumber: z.number().int(),
  isCurrent: z.boolean(),
  currency: currencyCodeSchema,
  rentAmount: moneyAmountStringSchema,
  depositAmount: moneyAmountStringSchema,
  rentCadence: rentCadenceSchema,
  effectiveFrom: z.string(),
  effectiveTo: z.string().nullable(),
  recurringCharges: z.array(recurringChargeInputSchema),
  lockedAt: z.string().datetime().nullable(),
});
export type LeaseTermResponse = z.infer<typeof leaseTermResponseSchema>;

export const leaseAllocationResponseSchema = z.object({
  id: z.string().uuid(),
  unitId: z.string().uuid(),
  bedId: z.string().uuid().nullable(),
  allocationType: leaseAllocationTypeSchema,
  capacityQuantity: z.number().int(),
  status: leaseAllocationStatusSchema,
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
});
export type LeaseAllocationResponse = z.infer<typeof leaseAllocationResponseSchema>;

export const leaseResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  propertyId: z.string().uuid(),
  leaseNumber: z.string().nullable(),
  status: leaseStatusSchema,
  occupancyState: z.enum(['NOT_MOVED_IN', 'OCCUPIED', 'MOVED_OUT']),
  moveOutStatus: z.enum(['NONE', 'IN_PROGRESS', 'COMPLETED']),
  currency: currencyCodeSchema,
  startDate: z.string(),
  endDate: z.string().nullable(),
  activatedAt: z.string().datetime().nullable(),
  movedInAt: z.string().datetime().nullable(),
  movedOutAt: z.string().datetime().nullable(),
  noticeDate: z.string().nullable(),
  noticeEffectiveEnd: z.string().nullable(),
  terminationReason: z.string().nullable(),
  terminatedAt: z.string().datetime().nullable(),
  renewedFromLeaseId: z.string().uuid().nullable(),
  holdoverFlag: z.boolean(),
  notes: z.string().nullable(),
  version: z.number().int(),
  occupancyNote: z.string(),
  depositDispositionNote: z.string(),
  terms: leaseTermResponseSchema.nullable(),
  parties: z.array(leasePartyResponseSchema),
  allocations: z.array(leaseAllocationResponseSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LeaseResponse = z.infer<typeof leaseResponseSchema>;

export const leasesCollectionSchema = createCursorCollectionSchema(leaseResponseSchema);
export type LeasesCollection = z.infer<typeof leasesCollectionSchema>;

export const leaseReviewIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['ERROR', 'WARNING']),
});
export type LeaseReviewIssue = z.infer<typeof leaseReviewIssueSchema>;

export const leaseReviewResponseSchema = z.object({
  leaseId: z.string().uuid(),
  version: z.number().int(),
  ready: z.boolean(),
  issues: z.array(leaseReviewIssueSchema),
  summary: z.object({
    status: leaseStatusSchema,
    propertyId: z.string().uuid(),
    currency: currencyCodeSchema,
    rentAmount: moneyAmountStringSchema.nullable(),
    depositAmount: moneyAmountStringSchema.nullable(),
    startDate: z.string(),
    endDate: z.string().nullable(),
    primaryPartyIds: z.array(z.string().uuid()),
    allocationCount: z.number().int(),
  }),
});
export type LeaseReviewResponse = z.infer<typeof leaseReviewResponseSchema>;

export const leaseHistoryEventSchema = z.object({
  id: z.string().uuid(),
  fromStatus: leaseStatusSchema.nullable(),
  toStatus: leaseStatusSchema,
  reason: z.string().nullable(),
  actorUserId: z.string().uuid().nullable(),
  recordedAt: z.string().datetime(),
  effectiveAt: z.string().datetime(),
  metadata: z.record(z.unknown()),
});
export type LeaseHistoryEvent = z.infer<typeof leaseHistoryEventSchema>;

export const leaseHistoryCollectionSchema = createCursorCollectionSchema(leaseHistoryEventSchema);
export type LeaseHistoryCollection = z.infer<typeof leaseHistoryCollectionSchema>;
