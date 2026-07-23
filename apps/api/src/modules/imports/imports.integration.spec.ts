import { randomUUID } from 'node:crypto';

import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { INVENTORY_IMPORT_CSV_HEADERS, SYSTEM_ROLE_KEYS } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { loadApiConfig } from '../../bootstrap/configuration';
import { PasswordHasherService } from '../../infrastructure/crypto/crypto.services';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { S3StorageClient } from '../../infrastructure/storage/s3-storage.client';
import { AuditService } from '../audit/audit.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { BulkStatusService } from './application/bulk-status.service';
import { ExportService } from './application/export.service';
import { ImportService } from './application/import.service';
import { processInventoryImportCommit } from './application/inventory-import-commit.processor';
import { OperationsService } from './application/operations.service';

const databaseAvailable = await isDatabaseReachable();

function inventoryCsv(rows: string[][]): string {
  return `${INVENTORY_IMPORT_CSV_HEADERS.join(',')}\n${rows.map((r) => r.join(',')).join('\n')}\n`;
}

function validRow(overrides?: Partial<Record<string, string>>): string[] {
  const base: Record<string, string> = {
    property_code: 'P-IMP',
    property_name: 'Import House',
    property_type: 'APARTMENT',
    address_line1: '10 Import St',
    city: 'Austin',
    region: 'TX',
    postal_code: '78701',
    country_code: 'US',
    time_zone: 'America/Chicago',
    default_currency: 'USD',
    building_code: '',
    unit_code: 'U-1',
    unit_name: 'Unit 1',
    unit_type: 'APARTMENT',
    allocation_mode: 'WHOLE_UNIT',
    capacity: '1',
    bed_code: '',
    bed_label: '',
    amenity_codes: '',
    ...overrides,
  };
  return INVENTORY_IMPORT_CSV_HEADERS.map((h) => base[h] ?? '');
}

describe.skipIf(!databaseAvailable)('Imports isolation (Sprint-06)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const outbox = new OutboxService(prisma as never);
  const idempotency = new IdempotencyService(prisma as never);
  const storage = new S3StorageClient(loadApiConfig() as never);
  const imports = new ImportService(
    prisma as never,
    transactions,
    outbox,
    idempotency,
    authorization,
    audit,
    storage,
  );
  const bulkStatus = new BulkStatusService(prisma as never, transactions, authorization, audit);
  const exports = new ExportService(prisma as never, authorization, audit, storage);
  const operations = new OperationsService(prisma as never);

  beforeAll(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
  });

  beforeEach(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
    S3StorageClient.clearLocalStore();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function provisionVerifiedUser(emailAddress: string, password: string) {
    const passwordHash = await passwords.hashPassword(password);
    return prisma.user.create({
      data: {
        email: emailAddress,
        normalizedEmail: emailAddress.toLowerCase(),
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        credentials: {
          create: { provider: 'LOCAL', passwordHash },
        },
      },
    });
  }

  async function createOwnerOrg(email: string, displayName: string) {
    const user = await provisionVerifiedUser(email, 'ValidPassword123!');
    const org = await organizations.createOrganization(user.id, { displayName });
    const membership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: user.id },
    });
    return { user, org, membership };
  }

  async function assignPropertyManager(orgId: string, propertyIds: string[]) {
    const pmRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: null, key: SYSTEM_ROLE_KEYS.PROPERTY_MANAGER },
    });
    const pmUser = await provisionVerifiedUser(
      `pm-${randomUUID()}@example.com`,
      'ValidPassword123!',
    );
    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId: orgId,
        userId: pmUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: orgId,
        membershipId: membership.id,
        roleId: pmRole.id,
      },
    });
    for (const propertyId of propertyIds) {
      await prisma.propertyAccessGrant.create({
        data: {
          id: randomUUID(),
          tenantId: orgId,
          membershipId: membership.id,
          propertyId,
          scopeType: 'SELECTED_PROPERTIES',
        },
      });
    }
    return { pmUser, membership };
  }

  it('T06-01: dry-run invalid CSV yields errors and zero inventory writes', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0601@example.com', 'Org T0601');
    const job = await imports.createImport(org.id, membership.id, user.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([
        validRow({ unit_code: '', unit_name: '' }),
        validRow({ property_type: 'NOT_A_TYPE', unit_code: 'U-2' }),
      ]),
    });

    const summary = await imports.dryRun(org.id, membership.id, user.id, job.id);
    expect(summary.counts.accepted).toBe(0);
    expect(summary.counts.rejected).toBeGreaterThanOrEqual(2);

    const properties = await prisma.property.count({ where: { tenantId: org.id } });
    const units = await prisma.unit.count({ where: { tenantId: org.id } });
    expect(properties).toBe(0);
    expect(units).toBe(0);

    const errors = await imports.getErrorsCsv(org.id, membership.id, job.id);
    expect(errors.body).toContain('REJECTED');
  });

  it('T06-02: commit valid file creates units and completes job', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0602@example.com', 'Org T0602');
    const job = await imports.createImport(org.id, membership.id, user.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([
        validRow(),
        validRow({
          unit_code: 'U-2',
          unit_name: 'Unit 2',
          allocation_mode: 'BED',
          capacity: '2',
          bed_code: 'B1',
          bed_label: 'Bed 1',
          unit_type: 'SHARED_ROOM',
        }),
      ]),
    });

    const dry = await imports.dryRun(org.id, membership.id, user.id, job.id);
    expect(dry.counts.accepted).toBe(2);

    const committed = await imports.commit(
      org.id,
      membership.id,
      user.id,
      job.id,
      `idem-${randomUUID()}`,
      'hash-commit-t0602',
    );
    expect(committed.replayed).toBe(false);

    await processInventoryImportCommit(prisma, {
      tenantId: org.id,
      importJobId: job.id,
      actorUserId: user.id,
    });

    const units = await prisma.unit.findMany({ where: { tenantId: org.id, deletedAt: null } });
    expect(units).toHaveLength(2);
    const beds = await prisma.bed.findMany({ where: { tenantId: org.id, deletedAt: null } });
    expect(beds).toHaveLength(1);

    const status = await imports.getImport(org.id, membership.id, job.id);
    expect(status.status).toBe('COMPLETED');
    expect(status.counts.applied).toBe(2);
  });

  it('T06-03: re-commit same idempotency key does not duplicate units', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0603@example.com', 'Org T0603');
    const job = await imports.createImport(org.id, membership.id, user.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([validRow({ property_code: 'P-IDEM', unit_code: 'U-IDEM' })]),
    });
    await imports.dryRun(org.id, membership.id, user.id, job.id);

    const key = `idem-stable-${org.id}`;
    const hash = 'hash-stable-t0603';
    const first = await imports.commit(org.id, membership.id, user.id, job.id, key, hash);
    const second = await imports.commit(org.id, membership.id, user.id, job.id, key, hash);
    expect(second.replayed).toBe(true);
    expect(second.body.id).toBe(first.body.id);

    await processInventoryImportCommit(prisma, {
      tenantId: org.id,
      importJobId: job.id,
      actorUserId: user.id,
    });
    // Resume / replay of worker must not create duplicates
    await processInventoryImportCommit(prisma, {
      tenantId: org.id,
      importJobId: job.id,
      actorUserId: user.id,
    });

    const units = await prisma.unit.count({
      where: { tenantId: org.id, code: 'U-IDEM', deletedAt: null },
    });
    expect(units).toBe(1);

    const outboxCount = await prisma.outboxEvent.count({
      where: { tenantId: org.id, eventType: 'inventory.import.commit' },
    });
    expect(outboxCount).toBe(1);
  });

  it('T06-04: partial invalid rows → partial success + reject reasons', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0604@example.com', 'Org T0604');
    const job = await imports.createImport(org.id, membership.id, user.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([
        validRow({ property_code: 'P-PART', unit_code: 'U-OK' }),
        validRow({ property_code: 'P-PART', unit_code: '', unit_name: '' }),
      ]),
    });

    const dry = await imports.dryRun(org.id, membership.id, user.id, job.id);
    expect(dry.counts.accepted).toBe(1);
    expect(dry.counts.rejected).toBe(1);

    await imports.commit(
      org.id,
      membership.id,
      user.id,
      job.id,
      `idem-${randomUUID()}`,
      'hash-t0604',
    );
    await processInventoryImportCommit(prisma, {
      tenantId: org.id,
      importJobId: job.id,
      actorUserId: user.id,
    });

    const status = await imports.getImport(org.id, membership.id, job.id);
    expect(status.status).toBe('PARTIALLY_COMPLETED');
    expect(status.counts.applied).toBe(1);

    const errors = await imports.getErrorsCsv(org.id, membership.id, job.id);
    expect(errors.body).toContain('REJECTED');
  });

  it('T06-05: PM import affecting other property is skipped', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0605@example.com', 'Org T0605');
    const inScope = await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'P-SCOPE-A',
        name: 'Scoped A',
        propertyType: 'APARTMENT',
        addressLine1: '1 A',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });
    await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'P-SCOPE-B',
        name: 'Scoped B',
        propertyType: 'APARTMENT',
        addressLine1: '1 B',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });

    const { pmUser, membership: pmMembership } = await assignPropertyManager(org.id, [inScope.id]);

    const job = await imports.createImport(org.id, pmMembership.id, pmUser.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([
        validRow({ property_code: 'P-SCOPE-B', unit_code: 'U-X' }),
        validRow({ property_code: 'P-SCOPE-A', unit_code: 'U-Y', unit_name: 'Y' }),
      ]),
    });

    const dry = await imports.dryRun(org.id, pmMembership.id, pmUser.id, job.id);
    expect(dry.counts.skipped).toBe(1);
    expect(dry.counts.accepted).toBe(1);

    await imports.commit(
      org.id,
      pmMembership.id,
      pmUser.id,
      job.id,
      `idem-pm-${randomUUID()}`,
      'hash-pm-scope',
    );
    await processInventoryImportCommit(prisma, {
      tenantId: org.id,
      importJobId: job.id,
      actorUserId: pmUser.id,
    });

    const units = await prisma.unit.findMany({ where: { tenantId: org.id, deletedAt: null } });
    expect(units).toHaveLength(1);
    expect(units[0]?.propertyId).toBe(inScope.id);

    void user;
    void membership;
  });

  it('T06-06: cross-org import id returns 404', async () => {
    const a = await createOwnerOrg('owner-t0606a@example.com', 'Org T0606A');
    const b = await createOwnerOrg('owner-t0606b@example.com', 'Org T0606B');

    const job = await imports.createImport(a.org.id, a.membership.id, a.user.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([validRow()]),
    });

    await expect(imports.getImport(b.org.id, b.membership.id, job.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      imports.dryRun(b.org.id, b.membership.id, b.user.id, job.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T06-07: bulk status preview/commit is scoped and audited', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0607@example.com', 'Org T0607');
    const propertyA = await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'P-BULK-A',
        name: 'Bulk A',
        propertyType: 'APARTMENT',
        addressLine1: '1',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });
    const propertyB = await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'P-BULK-B',
        name: 'Bulk B',
        propertyType: 'APARTMENT',
        addressLine1: '2',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });
    const unitA = await prisma.unit.create({
      data: {
        tenantId: org.id,
        propertyId: propertyA.id,
        code: 'UA',
        name: 'UA',
        unitType: 'APARTMENT',
        allocationMode: 'WHOLE_UNIT',
        capacity: 1,
      },
    });
    const unitB = await prisma.unit.create({
      data: {
        tenantId: org.id,
        propertyId: propertyB.id,
        code: 'UB',
        name: 'UB',
        unitType: 'APARTMENT',
        allocationMode: 'WHOLE_UNIT',
        capacity: 1,
      },
    });

    const { pmUser, membership: pmMembership } = await assignPropertyManager(org.id, [
      propertyA.id,
    ]);

    const preview = await bulkStatus.previewOrCommit(org.id, pmMembership.id, pmUser.id, {
      mode: 'PREVIEW',
      unitIds: [unitA.id, unitB.id],
      status: 'UNDER_MAINTENANCE',
      reason: 'Seasonal',
    });
    expect(preview.eligibleUnitIds).toEqual([unitA.id]);
    expect(preview.exclusions.some((e) => e.unitId === unitB.id)).toBe(true);

    const committed = await bulkStatus.previewOrCommit(org.id, pmMembership.id, pmUser.id, {
      mode: 'COMMIT',
      unitIds: [unitA.id, unitB.id],
      status: 'UNDER_MAINTENANCE',
      reason: 'Seasonal',
    });
    expect(committed.updatedCount).toBe(1);

    const updatedA = await prisma.unit.findFirstOrThrow({ where: { id: unitA.id } });
    const updatedB = await prisma.unit.findFirstOrThrow({ where: { id: unitB.id } });
    expect(updatedA.operationalStatus).toBe('UNDER_MAINTENANCE');
    expect(updatedB.operationalStatus).toBe('ACTIVE');

    const auditRows = await prisma.auditEvent.findMany({
      where: { tenantId: org.id, action: 'unit.bulk_status' },
    });
    expect(auditRows.length).toBe(1);

    void user;
    void membership;
  });

  it('review: rejects cross-org objectKey on create', async () => {
    const a = await createOwnerOrg('owner-obj-a@example.com', 'Org ObjA');
    const b = await createOwnerOrg('owner-obj-b@example.com', 'Org ObjB');
    const foreignKey = `org/${b.org.id}/imports/leaked.csv`;

    await expect(
      imports.createImport(a.org.id, a.membership.id, a.user.id, {
        type: 'INVENTORY',
        objectKey: foreignKey,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('review: dry-run blocked after commit is claimed', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-dryblock@example.com', 'Org Dry');
    const job = await imports.createImport(org.id, membership.id, user.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([validRow({ property_code: 'P-DRY', unit_code: 'U-DRY' })]),
    });
    await imports.dryRun(org.id, membership.id, user.id, job.id);
    await imports.commit(
      org.id,
      membership.id,
      user.id,
      job.id,
      `idem-dry-${randomUUID()}`,
      'hash-dry-block',
    );

    await expect(imports.dryRun(org.id, membership.id, user.id, job.id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const outboxCount = await prisma.outboxEvent.count({
      where: { tenantId: org.id, eventType: 'inventory.import.commit' },
    });
    expect(outboxCount).toBe(1);

    // Second commit with a different key must not enqueue another outbox while PROCESSING.
    await imports.commit(
      org.id,
      membership.id,
      user.id,
      job.id,
      `idem-dry-2-${randomUUID()}`,
      'hash-dry-block-2',
    );
    const outboxAfter = await prisma.outboxEvent.count({
      where: { tenantId: org.id, eventType: 'inventory.import.commit' },
    });
    expect(outboxAfter).toBe(1);
  });

  it('review: scoped actor cannot import brand-new property codes', async () => {
    const { org } = await createOwnerOrg('owner-newprop@example.com', 'Org NewProp');
    const inScope = await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'P-KNOWN',
        name: 'Known',
        propertyType: 'APARTMENT',
        addressLine1: '1',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });
    const { pmUser, membership: pmMembership } = await assignPropertyManager(org.id, [inScope.id]);

    const job = await imports.createImport(org.id, pmMembership.id, pmUser.id, {
      type: 'INVENTORY',
      csvText: inventoryCsv([validRow({ property_code: 'P-BRAND-NEW', unit_code: 'U-NEW' })]),
    });
    const dry = await imports.dryRun(org.id, pmMembership.id, pmUser.id, job.id);
    expect(dry.counts.accepted).toBe(0);
    expect(dry.counts.skipped).toBe(1);
  });

  it('T06-12: export is scoped and returns csvText', async () => {
    const { user, org, membership } = await createOwnerOrg(
      'owner-export@example.com',
      'Org Export',
    );
    const property = await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'P-EXP',
        name: 'Export Prop',
        propertyType: 'APARTMENT',
        addressLine1: '1',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
      },
    });
    await prisma.unit.create({
      data: {
        tenantId: org.id,
        propertyId: property.id,
        code: 'U-EXP',
        name: 'Export Unit',
        unitType: 'APARTMENT',
        allocationMode: 'WHOLE_UNIT',
        capacity: 1,
      },
    });

    const result = await exports.createExport(org.id, membership.id, user.id, {
      type: 'INVENTORY',
      sync: true,
      limit: 100,
    });
    expect(result.csvText).toContain('U-EXP');
    expect(result.truncated).toBe(false);

    const ops = await operations.listOperations(org.id, { limit: 10 });
    expect(ops.data.some((item) => item.kind === 'EXPORT' && item.id === result.id)).toBe(true);
  });
});
