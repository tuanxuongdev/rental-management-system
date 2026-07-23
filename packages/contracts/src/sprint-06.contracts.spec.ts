import { describe, expect, it } from 'vitest';

import {
  IMPORT_PERMISSION_KEYS,
  INVENTORY_IMPORT_CSV_HEADERS,
  INVENTORY_IMPORT_COMMIT_EVENT_TYPE,
  ORGANIZATION_IMPORTS_PATH,
  ORGANIZATION_IMPORT_COMMIT_PATH,
  ORGANIZATION_UNITS_BULK_STATUS_PATH,
  createImportRequestSchema,
  dryRunSummarySchema,
  importJobStatusSchema,
  bulkUnitStatusRequestSchema,
  exportJobResponseSchema,
} from './index';

describe('@rpm/contracts Sprint-06 imports', () => {
  it('exposes import path constants and permission keys', () => {
    expect(ORGANIZATION_IMPORTS_PATH).toBe('/v1/organizations/{organizationId}/imports');
    expect(ORGANIZATION_IMPORT_COMMIT_PATH).toBe(
      '/v1/organizations/{organizationId}/imports/{importId}/commit',
    );
    expect(ORGANIZATION_UNITS_BULK_STATUS_PATH).toBe(
      '/v1/organizations/{organizationId}/units/bulk-status',
    );
    expect(IMPORT_PERMISSION_KEYS.IMPORTS_INVENTORY).toBe('imports.inventory');
    expect(IMPORT_PERMISSION_KEYS.EXPORTS_INVENTORY).toBe('exports.inventory');
    expect(IMPORT_PERMISSION_KEYS.OPERATIONS_READ).toBe('operations.read');
    expect(INVENTORY_IMPORT_COMMIT_EVENT_TYPE).toBe('inventory.import.commit');
  });

  it('validates job statuses and create/dry-run/bulk/export schemas', () => {
    expect(importJobStatusSchema.parse('QUEUED')).toBe('QUEUED');
    expect(importJobStatusSchema.parse('PARTIALLY_COMPLETED')).toBe('PARTIALLY_COMPLETED');

    const created = createImportRequestSchema.parse({
      csvText: 'property_code,unit_code\nP1,U1\n',
    });
    expect(created.type).toBe('INVENTORY');

    const summary = dryRunSummarySchema.parse({
      importId: '00000000-0000-4000-8000-000000000001',
      status: 'QUEUED',
      counts: { total: 1, accepted: 1, rejected: 0, skipped: 0, applied: 0 },
    });
    expect(summary.counts.accepted).toBe(1);

    const bulk = bulkUnitStatusRequestSchema.parse({
      unitIds: ['00000000-0000-4000-8000-000000000010'],
      status: 'UNAVAILABLE',
      reason: 'Paint',
    });
    expect(bulk.mode).toBe('PREVIEW');

    const exported = exportJobResponseSchema.parse({
      id: '00000000-0000-4000-8000-000000000020',
      organizationId: '00000000-0000-4000-8000-000000000021',
      type: 'INVENTORY',
      status: 'COMPLETED',
      actorUserId: '00000000-0000-4000-8000-000000000022',
      objectKey: 'org/x/exports/a.csv',
      counts: { total: 3 },
      createdAt: '2026-07-23T00:00:00.000Z',
      updatedAt: '2026-07-23T00:00:00.000Z',
    });
    expect(exported.counts.total).toBe(3);
  });

  it('lists canonical inventory CSV headers from handoff', () => {
    expect(INVENTORY_IMPORT_CSV_HEADERS).toContain('property_code');
    expect(INVENTORY_IMPORT_CSV_HEADERS).toContain('allocation_mode');
    expect(INVENTORY_IMPORT_CSV_HEADERS).toContain('bed_code');
  });
});
