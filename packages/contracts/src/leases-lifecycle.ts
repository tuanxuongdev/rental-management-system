import { z } from 'zod';

import { leaseAllocationWriteSchema } from './leases';
import { moneyAmountStringSchema } from './money';
import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const LEASE_LIFECYCLE_PERMISSION_KEYS = {
  MOVE_IN: PERMISSION_KEYS.LEASES_MOVE_IN,
  RENEW: PERMISSION_KEYS.LEASES_RENEW,
  TRANSFER: PERMISSION_KEYS.LEASES_TRANSFER,
  MOVE_OUT: PERMISSION_KEYS.LEASES_MOVE_OUT,
  TERMINATE: PERMISSION_KEYS.LEASES_TERMINATE,
  ASSETS_KEYS_MANAGE: PERMISSION_KEYS.ASSETS_KEYS_MANAGE,
} as const;

export const ORGANIZATION_LEASE_PENDING_ACTIONS_PATH =
  '/v1/organizations/{organizationId}/leases/pending-actions' as const;
export const ORGANIZATION_LEASE_MOVE_IN_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/move-in' as const;
export const ORGANIZATION_LEASE_RENEW_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/renew' as const;
export const ORGANIZATION_LEASE_TRANSFER_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/transfer' as const;
export const ORGANIZATION_LEASE_NOTICE_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/notice' as const;
export const ORGANIZATION_LEASE_MOVE_OUT_START_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/move-out/start' as const;
export const ORGANIZATION_LEASE_MOVE_OUT_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/move-out' as const;
export const ORGANIZATION_LEASE_MOVE_OUT_COMPLETE_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/move-out/complete' as const;
export const ORGANIZATION_LEASE_TERMINATE_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/terminate' as const;
export const ORGANIZATION_LEASE_OCCUPANCY_EVENTS_PATH =
  '/v1/organizations/{organizationId}/leases/{leaseId}/occupancy-events' as const;
export const ORGANIZATION_DASHBOARD_HOME_PATH =
  '/v1/organizations/{organizationId}/dashboard/home' as const;

export const LEASE_MOVED_IN_EVENT_TYPE = 'lease.moved_in' as const;
export const LEASE_RENEWED_EVENT_TYPE = 'lease.renewed' as const;
export const LEASE_TRANSFERRED_EVENT_TYPE = 'lease.transferred' as const;
export const LEASE_MOVE_OUT_COMPLETED_EVENT_TYPE = 'lease.move_out_completed' as const;
export const LEASE_TERMINATED_EVENT_TYPE = 'lease.terminated' as const;
export const LEASE_NOTICE_RECORDED_EVENT_TYPE = 'lease.notice_recorded' as const;

export const leaseOccupancyStateSchema = z.enum(['NOT_MOVED_IN', 'OCCUPIED', 'MOVED_OUT']);
export type LeaseOccupancyState = z.infer<typeof leaseOccupancyStateSchema>;

export const leaseMoveOutStatusSchema = z.enum(['NONE', 'IN_PROGRESS', 'COMPLETED']);
export type LeaseMoveOutStatus = z.infer<typeof leaseMoveOutStatusSchema>;

export const occupancyEventTypeSchema = z.enum([
  'MOVED_IN',
  'MOVED_OUT',
  'NOTICE_RECORDED',
  'RENEWED',
  'TRANSFERRED',
  'TERMINATED',
  'HOLDOVER_FLAGGED',
]);
export type OccupancyEventType = z.infer<typeof occupancyEventTypeSchema>;

export const assetKeyStatusSchema = z.enum(['ISSUED', 'RETURNED', 'LOST', 'DAMAGED']);
export type AssetKeyStatus = z.infer<typeof assetKeyStatusSchema>;

const checklistItemSchema = z.object({
  key: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
  completed: z.boolean(),
  notes: z.string().max(2000).optional(),
});

export const assetKeyCheckoutSchema = z.object({
  label: z.string().min(1).max(200),
  code: z.string().max(64).optional(),
  unitId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});
export type AssetKeyCheckout = z.infer<typeof assetKeyCheckoutSchema>;

export const assetKeyReturnSchema = z.object({
  assetKeyId: z.string().uuid(),
  status: z.enum(['RETURNED', 'LOST', 'DAMAGED']),
  notes: z.string().max(2000).optional(),
});
export type AssetKeyReturn = z.infer<typeof assetKeyReturnSchema>;

export const checklistMeterReadingSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(64),
  unit: z.string().max(32).optional(),
  recordedAt: z.string().datetime().optional(),
});

export const moveInRequestSchema = z.object({
  movedInAt: z.string().datetime().optional(),
  checklistAcknowledged: z.literal(true),
  checklist: z.array(checklistItemSchema).max(50).optional(),
  meterReadings: z.array(checklistMeterReadingSchema).max(20).optional(),
  assetCheckouts: z.array(assetKeyCheckoutSchema).max(20).optional(),
  documentIds: z.array(z.string().uuid()).max(20).optional(),
  notes: z.string().max(4000).optional(),
});
export type MoveInRequest = z.infer<typeof moveInRequestSchema>;

export const renewLeaseRequestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  rentAmount: moneyAmountStringSchema.optional(),
  depositAmount: moneyAmountStringSchema.optional(),
  copyParties: z.boolean().optional().default(true),
  copyAllocation: z.boolean().optional().default(true),
  notes: z.string().max(4000).optional(),
});
export type RenewLeaseRequest = z.infer<typeof renewLeaseRequestSchema>;

export const transferLeaseRequestSchema = z.object({
  allocation: leaseAllocationWriteSchema,
  effectiveAt: z.string().datetime().optional(),
  reason: z.string().min(3).max(1000),
});
export type TransferLeaseRequest = z.infer<typeof transferLeaseRequestSchema>;

export const noticeLeaseRequestSchema = z.object({
  noticeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  proposedEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().min(3).max(1000),
  serviceMethod: z.string().min(1).max(64).optional(),
});
export type NoticeLeaseRequest = z.infer<typeof noticeLeaseRequestSchema>;

export const startMoveOutRequestSchema = z.object({
  startedAt: z.string().datetime().optional(),
  notes: z.string().max(4000).optional(),
});
export type StartMoveOutRequest = z.infer<typeof startMoveOutRequestSchema>;

export const patchMoveOutRequestSchema = z.object({
  checklist: z.array(checklistItemSchema).max(50).optional(),
  meterReadings: z.array(checklistMeterReadingSchema).max(20).optional(),
  assetReturns: z.array(assetKeyReturnSchema).max(20).optional(),
  /** When true, mark every ISSUED key on the lease RETURNED (requires assets.keys.manage). */
  returnAllIssuedKeys: z.boolean().optional(),
  documentIds: z.array(z.string().uuid()).max(20).optional(),
  depositDispositionPreview: z
    .object({
      outcome: z.enum(['PENDING_FINANCE', 'FORFEIT_PREVIEW', 'REFUND_PREVIEW', 'PARTIAL_PREVIEW']),
      notes: z.string().max(2000).optional(),
      amountPreview: moneyAmountStringSchema.optional(),
    })
    .optional(),
  notes: z.string().max(4000).optional(),
});
export type PatchMoveOutRequest = z.infer<typeof patchMoveOutRequestSchema>;

export const completeMoveOutRequestSchema = z.object({
  movedOutAt: z.string().datetime().optional(),
  checklistAcknowledged: z.literal(true),
  confirmation: z.literal(true),
  keysReconciled: z.literal(true),
});
export type CompleteMoveOutRequest = z.infer<typeof completeMoveOutRequestSchema>;

export const terminateLeaseRequestSchema = z.object({
  effectiveAt: z.string().datetime().optional(),
  reason: z.string().min(3).max(1000),
  confirmation: z.literal(true),
  inventoryRelease: z.boolean().optional(),
});
export type TerminateLeaseRequest = z.infer<typeof terminateLeaseRequestSchema>;

export const occupancyEventResponseSchema = z.object({
  id: z.string().uuid(),
  leaseId: z.string().uuid(),
  partyId: z.string().uuid().nullable(),
  eventType: occupancyEventTypeSchema,
  occurredAt: z.string().datetime(),
  recordedAt: z.string().datetime(),
  actorUserId: z.string().uuid().nullable(),
  payload: z.record(z.unknown()),
});
export type OccupancyEventResponse = z.infer<typeof occupancyEventResponseSchema>;

export const occupancyEventsCollectionSchema = createCursorCollectionSchema(
  occupancyEventResponseSchema,
);
export type OccupancyEventsCollection = z.infer<typeof occupancyEventsCollectionSchema>;

export const pendingActionKindSchema = z.enum([
  'MOVE_IN_DUE',
  'EXPIRING_SOON',
  'MOVE_OUT_DUE',
  'HOLDOVER',
  'CHECKOUT_IN_PROGRESS',
]);
export type PendingActionKind = z.infer<typeof pendingActionKindSchema>;

export const pendingLeaseActionSchema = z.object({
  leaseId: z.string().uuid(),
  leaseNumber: z.string().nullable(),
  propertyId: z.string().uuid(),
  status: z.string(),
  occupancyState: leaseOccupancyStateSchema,
  kind: pendingActionKindSchema,
  dueDate: z.string().nullable(),
  primaryPartyName: z.string().nullable().optional(),
});
export type PendingLeaseAction = z.infer<typeof pendingLeaseActionSchema>;

export const pendingLeaseActionsResponseSchema = z.object({
  data: z.array(pendingLeaseActionSchema),
  meta: z.object({
    asOf: z.string().datetime(),
    expiryWindowDays: z.number().int(),
  }),
});
export type PendingLeaseActionsResponse = z.infer<typeof pendingLeaseActionsResponseSchema>;

export const dashboardHomeSummarySchema = z.object({
  asOf: z.string().datetime(),
  moveInsDue: z.number().int(),
  expiringSoon: z.number().int(),
  moveOutsDue: z.number().int(),
  holdovers: z.number().int(),
  checkoutsInProgress: z.number().int(),
  actions: z.array(pendingLeaseActionSchema).max(25),
  financeNote: z.literal(
    'Rent billing and invoices are available in Finance; payment collection begins in Sprint-11.',
  ),
});
export type DashboardHomeSummary = z.infer<typeof dashboardHomeSummarySchema>;
