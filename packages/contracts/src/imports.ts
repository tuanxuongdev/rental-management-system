import { z } from 'zod';

import { inventoryOperationalStatusSchema } from './inventory';
import { createCursorCollectionSchema } from './pagination';

/** Permission keys for Sprint-06 import/export/operations (catalog seed may land separately). */
export const IMPORT_PERMISSION_KEYS = {
  IMPORTS_INVENTORY: 'imports.inventory',
  EXPORTS_INVENTORY: 'exports.inventory',
  OPERATIONS_READ: 'operations.read',
} as const;

export const ORGANIZATION_IMPORTS_PATH = '/v1/organizations/{organizationId}/imports' as const;
export const ORGANIZATION_IMPORT_TEMPLATE_INVENTORY_PATH =
  '/v1/organizations/{organizationId}/imports/templates/inventory' as const;
export const ORGANIZATION_IMPORT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/imports/{importId}' as const;
export const ORGANIZATION_IMPORT_DRY_RUN_PATH =
  '/v1/organizations/{organizationId}/imports/{importId}/dry-run' as const;
export const ORGANIZATION_IMPORT_COMMIT_PATH =
  '/v1/organizations/{organizationId}/imports/{importId}/commit' as const;
export const ORGANIZATION_IMPORT_ERRORS_PATH =
  '/v1/organizations/{organizationId}/imports/{importId}/errors' as const;
export const ORGANIZATION_UNITS_BULK_STATUS_PATH =
  '/v1/organizations/{organizationId}/units/bulk-status' as const;
export const ORGANIZATION_OPERATIONS_PATH =
  '/v1/organizations/{organizationId}/operations' as const;
export const ORGANIZATION_EXPORTS_PATH = '/v1/organizations/{organizationId}/exports' as const;

export const importJobTypeSchema = z.enum(['INVENTORY']);
export type ImportJobType = z.infer<typeof importJobTypeSchema>;

export const importJobStatusSchema = z.enum([
  'QUEUED',
  'PROCESSING',
  'PARTIALLY_COMPLETED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;

export const importJobRowStatusSchema = z.enum(['ACCEPTED', 'REJECTED', 'SKIPPED']);
export type ImportJobRowStatus = z.infer<typeof importJobRowStatusSchema>;

export const exportJobTypeSchema = z.enum(['INVENTORY']);
export type ExportJobType = z.infer<typeof exportJobTypeSchema>;

export const importColumnMappingSchema = z.record(z.string(), z.string()).default({});
export type ImportColumnMapping = z.infer<typeof importColumnMappingSchema>;

export const createImportRequestSchema = z
  .object({
    type: importJobTypeSchema.default('INVENTORY'),
    mapping: importColumnMappingSchema.optional(),
    /** Object key after S3 upload; optional when `csvText` is provided (tests / inline). */
    objectKey: z.string().min(1).max(1024).optional(),
    /** Inline CSV for tests and environments without object storage. */
    csvText: z.string().min(1).max(5_000_000).optional(),
  })
  .refine((value) => value.csvText !== undefined || value.objectKey !== undefined, {
    message: 'csvText or objectKey is required',
    path: ['csvText'],
  });

export type CreateImportRequest = z.infer<typeof createImportRequestSchema>;

export const importJobCountsSchema = z.object({
  total: z.number().int().nonnegative().default(0),
  accepted: z.number().int().nonnegative().default(0),
  rejected: z.number().int().nonnegative().default(0),
  skipped: z.number().int().nonnegative().default(0),
  applied: z.number().int().nonnegative().default(0),
});

export type ImportJobCounts = z.infer<typeof importJobCountsSchema>;

export const dryRunSummarySchema = z.object({
  importId: z.string().uuid(),
  status: importJobStatusSchema,
  counts: importJobCountsSchema,
  warnings: z.array(z.string()).default([]),
  sampleAccepted: z.array(z.record(z.string(), z.unknown())).max(10).default([]),
});

export type DryRunSummary = z.infer<typeof dryRunSummarySchema>;

export const importJobResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: importJobTypeSchema,
  status: importJobStatusSchema,
  actorUserId: z.string().uuid(),
  mapping: z.record(z.string(), z.unknown()),
  objectKey: z.string().nullable(),
  errorObjectKey: z.string().nullable(),
  counts: importJobCountsSchema,
  version: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ImportJobResponse = z.infer<typeof importJobResponseSchema>;

export const bulkUnitStatusModeSchema = z.enum(['PREVIEW', 'COMMIT']);

export const bulkUnitStatusRequestSchema = z.object({
  mode: bulkUnitStatusModeSchema.default('PREVIEW'),
  unitIds: z.array(z.string().uuid()).min(1).max(500),
  status: inventoryOperationalStatusSchema,
  reason: z.string().min(1).max(500),
  effectiveFrom: z.string().datetime().optional(),
});

export type BulkUnitStatusRequest = z.infer<typeof bulkUnitStatusRequestSchema>;

export const bulkUnitStatusExclusionSchema = z.object({
  unitId: z.string().uuid(),
  reason: z.string().min(1),
  code: z.string().min(1),
});

export type BulkUnitStatusExclusion = z.infer<typeof bulkUnitStatusExclusionSchema>;

export const bulkUnitStatusResponseSchema = z.object({
  mode: bulkUnitStatusModeSchema,
  status: inventoryOperationalStatusSchema,
  eligibleUnitIds: z.array(z.string().uuid()),
  exclusions: z.array(bulkUnitStatusExclusionSchema),
  updatedCount: z.number().int().nonnegative(),
});

export type BulkUnitStatusResponse = z.infer<typeof bulkUnitStatusResponseSchema>;

export const createExportRequestSchema = z.object({
  type: exportJobTypeSchema.default('INVENTORY'),
  propertyId: z.string().uuid().optional(),
  /** When true and row count is within bound, return CSV inline synchronously. */
  sync: z.boolean().default(true),
  /** Hard cap matches sync export bound (5_000). */
  limit: z.number().int().min(1).max(5_000).default(5_000),
});

export type CreateExportRequest = z.infer<typeof createExportRequestSchema>;

export const exportJobResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  type: exportJobTypeSchema,
  status: importJobStatusSchema,
  actorUserId: z.string().uuid(),
  objectKey: z.string().nullable(),
  counts: z.object({
    total: z.number().int().nonnegative().default(0),
  }),
  /** True when more rows exist beyond the returned/export bound. */
  truncated: z.boolean().default(false),
  /** Present for bounded sync exports. */
  csvText: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ExportJobResponse = z.infer<typeof exportJobResponseSchema>;

export const operationsJobItemSchema = z.object({
  id: z.string().uuid(),
  type: z.string().min(1),
  kind: z.enum(['IMPORT', 'EXPORT', 'BILLING_RUN']),
  status: importJobStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  counts: z.record(z.string(), z.number()).optional(),
});

export type OperationsJobItem = z.infer<typeof operationsJobItemSchema>;

export const operationsJobsCollectionSchema = createCursorCollectionSchema(operationsJobItemSchema);
export type OperationsJobsCollection = z.infer<typeof operationsJobsCollectionSchema>;

/** Canonical inventory import CSV header row (Sprint-06 handoff). */
export const INVENTORY_IMPORT_CSV_HEADERS = [
  'property_code',
  'property_name',
  'property_type',
  'address_line1',
  'city',
  'region',
  'postal_code',
  'country_code',
  'time_zone',
  'default_currency',
  'building_code',
  'unit_code',
  'unit_name',
  'unit_type',
  'allocation_mode',
  'capacity',
  'bed_code',
  'bed_label',
  'amenity_codes',
] as const;

export const INVENTORY_IMPORT_COMMIT_EVENT_TYPE = 'inventory.import.commit' as const;
