import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PERMISSION_KEYS, SYSTEM_ROLE_KEYS } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { requireIfMatchVersion } from '../../common/auth/if-match';
import { PasswordHasherService } from '../../infrastructure/crypto/crypto.services';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../inventory/application/availability.service';
import { BedService } from '../inventory/application/bed.service';
import { PropertyService } from '../inventory/application/property.service';
import { UnitService } from '../inventory/application/unit.service';
import { ManagementAgreementService } from '../parties/application/management-agreement.service';
import { OwnershipService } from '../parties/application/ownership.service';
import { PropertyOwnerService } from '../parties/application/property-owner.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Inventory + parties isolation (Sprint-05)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);

  const properties = new PropertyService(prisma as never, transactions, authorization, audit);
  const units = new UnitService(prisma as never, transactions, authorization, audit);
  const beds = new BedService(prisma as never, transactions, authorization, audit);
  const availability = new AvailabilityService(prisma as never, authorization);
  const owners = new PropertyOwnerService(prisma as never, transactions, audit);
  const ownerships = new OwnershipService(prisma as never, authorization, audit);
  const agreements = new ManagementAgreementService(
    prisma as never,
    transactions,
    authorization,
    audit,
  );

  beforeAll(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
  });

  beforeEach(async () => {
    await resetPlatformTables(prisma);
    await rbacSeed.ensureCatalog();
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

  async function assignPropertyManager(
    orgId: string,
    ownerMembershipId: string,
    ownerUserId: string,
    propertyIds: string[],
  ) {
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
    void ownerMembershipId;
    void ownerUserId;
    return { pmUser, membership };
  }

  it('T05-01: create property/unit/bed happy path (persisted + audited)', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t01@example.com', 'Org T01');

    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P-01',
      name: 'Alpha House',
      propertyType: 'BOARDING_HOUSE',
      addressLine1: '1 Main St',
      city: 'Austin',
      timeZone: 'America/Chicago',
      defaultCurrency: 'USD',
    });
    expect(property.id).toBeTruthy();

    const unit = await units.createUnit(org.id, membership.id, user.id, property.id, {
      code: 'U-1',
      name: 'Shared A',
      unitType: 'SHARED_ROOM',
      allocationMode: 'BED',
      capacity: 4,
    });
    expect(unit.allocationMode).toBe('BED');

    const bed = await beds.createBed(org.id, membership.id, user.id, unit.id, {
      code: 'B1',
      label: 'Bed 1',
    });
    expect(bed.unitId).toBe(unit.id);

    const auditRows = await prisma.auditEvent.findMany({
      where: { tenantId: org.id, action: { in: ['property.create', 'unit.create', 'bed.create'] } },
    });
    expect(auditRows.length).toBe(3);

    const history = await prisma.inventoryStatusHistory.count({
      where: { tenantId: org.id },
    });
    expect(history).toBeGreaterThanOrEqual(3);
  });

  it('T05-02: list units with cursor pagination (stable order)', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t02@example.com', 'Org T02');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P-02',
      name: 'Beta',
      propertyType: 'APARTMENT',
      addressLine1: '2 Main',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    for (let i = 0; i < 3; i += 1) {
      await units.createUnit(org.id, membership.id, user.id, property.id, {
        code: `U-${i}`,
        name: `Unit ${i}`,
        unitType: 'APARTMENT',
        allocationMode: 'WHOLE_UNIT',
        capacity: 1,
      });
    }

    const page1 = await units.listUnits(org.id, membership.id, property.id, { limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.page.nextCursor).toBeTruthy();

    const page2 = await units.listUnits(org.id, membership.id, property.id, {
      limit: 2,
      after: page1.page.nextCursor!,
    });
    expect(page2.data).toHaveLength(1);
    expect(page1.data[0]!.id < page1.data[1]!.id).toBe(true);
    expect(page1.data[1]!.id < page2.data[0]!.id).toBe(true);
  });

  it('T05-03: Property Manager outside grant gets 404 / empty list', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t03@example.com', 'Org T03');
    const inScope = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'IN',
      name: 'In Scope',
      propertyType: 'APARTMENT',
      addressLine1: '1 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const outScope = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'OUT',
      name: 'Out Scope',
      propertyType: 'APARTMENT',
      addressLine1: '2 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    const { membership: pmMembership } = await assignPropertyManager(
      org.id,
      membership.id,
      user.id,
      [inScope.id],
    );

    const listed = await properties.listProperties(org.id, pmMembership.id);
    expect(listed.data.map((item) => item.id)).toEqual([inScope.id]);

    await expect(
      properties.getProperty(org.id, pmMembership.id, outScope.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T05-04: cross-org unit id returns 404', async () => {
    const a = await createOwnerOrg('owner-a@example.com', 'Org A');
    const b = await createOwnerOrg('owner-b@example.com', 'Org B');

    const propertyA = await properties.createProperty(a.org.id, a.user.id, a.membership.id, {
      code: 'A1',
      name: 'A Prop',
      propertyType: 'APARTMENT',
      addressLine1: '1 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const unitA = await units.createUnit(a.org.id, a.membership.id, a.user.id, propertyA.id, {
      code: 'U1',
      name: 'Unit 1',
      unitType: 'STUDIO',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });

    await expect(units.getUnit(b.org.id, b.membership.id, unitA.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('T05-05: bed under non-BED unit is rejected', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t05@example.com', 'Org T05');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P05',
      name: 'Apt',
      propertyType: 'APARTMENT',
      addressLine1: '5 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const unit = await units.createUnit(org.id, membership.id, user.id, property.id, {
      code: 'APT-1',
      name: 'Apt 1',
      unitType: 'APARTMENT',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });

    await expect(
      beds.createBed(org.id, membership.id, user.id, unit.id, {
        code: 'B1',
        label: 'Invalid',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('T05-06: archive property with active units is blocked', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t06@example.com', 'Org T06');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P06',
      name: 'Busy',
      propertyType: 'APARTMENT',
      addressLine1: '6 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    await units.createUnit(org.id, membership.id, user.id, property.id, {
      code: 'U1',
      name: 'Unit',
      unitType: 'STUDIO',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });

    await expect(
      properties.archiveProperty(org.id, membership.id, user.id, property.id),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROPERTY_HAS_ACTIVE_UNITS' }),
    });
    await expect(
      properties.archiveProperty(org.id, membership.id, user.id, property.id),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T05-07: ownership + agreement create no membership', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t07@example.com', 'Org T07');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P07',
      name: 'Owned',
      propertyType: 'APARTMENT',
      addressLine1: '7 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    const before = await prisma.tenantMembership.count({ where: { tenantId: org.id } });

    const owner = await owners.createOwner(org.id, user.id, {
      partyType: 'PERSON',
      displayName: 'Jane Owner',
      ownerCategory: 'INDIVIDUAL',
    });
    expect(owner.grantsLoginAccess).toBe(false);

    const ownership = await ownerships.createOwnership(
      org.id,
      membership.id,
      user.id,
      property.id,
      {
        ownerPartyId: owner.id,
        interestType: 'EQUITY',
        ownershipPercentage: '100.0000',
        effectiveFrom: new Date().toISOString(),
      },
    );
    expect(ownership.grantsLoginAccess).toBe(false);

    const agreement = await agreements.createAgreement(org.id, membership.id, user.id, {
      propertyId: property.id,
      agreementNumber: 'MA-001',
      effectiveFrom: new Date().toISOString(),
      partyIds: [owner.id],
    });
    expect(agreement.grantsLoginAccess).toBe(false);

    const after = await prisma.tenantMembership.count({ where: { tenantId: org.id } });
    expect(after).toBe(before);
  });

  it('T05-08: availability filter returns ACTIVE operational rows', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t08@example.com', 'Org T08');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P08',
      name: 'Avail',
      propertyType: 'APARTMENT',
      addressLine1: '8 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const active = await units.createUnit(org.id, membership.id, user.id, property.id, {
      code: 'ACTIVE',
      name: 'Active',
      unitType: 'STUDIO',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });
    const retired = await units.createUnit(org.id, membership.id, user.id, property.id, {
      code: 'RETIRED',
      name: 'Retired',
      unitType: 'STUDIO',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });
    await units.updateOperationalStatus(
      org.id,
      membership.id,
      user.id,
      retired.id,
      { status: 'RETIRED', reason: 'offline' },
      retired.version,
    );

    const result = await availability.listAvailability(org.id, membership.id, {
      propertyId: property.id,
    });
    expect(result.data.map((item) => item.unitId)).toContain(active.id);
    expect(result.data.map((item) => item.unitId)).not.toContain(retired.id);
  });

  it('T05-09: concurrent update without If-Match is rejected', async () => {
    expect(() => requireIfMatchVersion(undefined)).toThrow(HttpException);
    try {
      requireIfMatchVersion(undefined);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(428);
    }

    const { user, org, membership } = await createOwnerOrg('owner-t09@example.com', 'Org T09');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P09',
      name: 'Versioned',
      propertyType: 'APARTMENT',
      addressLine1: '9 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    await expect(
      properties.patchProperty(
        org.id,
        membership.id,
        user.id,
        property.id,
        { name: 'Changed' },
        property.version + 5,
      ),
    ).rejects.toBeInstanceOf(PreconditionFailedException);
  });

  it('T05-10: auditor PATCH unit is forbidden', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t10@example.com', 'Org T10');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P10',
      name: 'Audit',
      propertyType: 'APARTMENT',
      addressLine1: '10 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const unit = await units.createUnit(org.id, membership.id, user.id, property.id, {
      code: 'U10',
      name: 'Unit',
      unitType: 'STUDIO',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });

    const auditorRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: null, key: SYSTEM_ROLE_KEYS.AUDITOR },
    });
    const auditorUser = await provisionVerifiedUser('auditor@example.com', 'ValidPassword123!');
    const auditorMembership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: auditorUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: auditorMembership.id,
        roleId: auditorRole.id,
      },
    });

    await expect(
      authorization.assertPermission(auditorMembership.id, org.id, PERMISSION_KEYS.UNITS_UPDATE),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Auditor can view
    await authorization.assertPermission(auditorMembership.id, org.id, PERMISSION_KEYS.UNITS_VIEW);
    const viewed = await units.getUnit(org.id, auditorMembership.id, unit.id);
    expect(viewed.id).toBe(unit.id);
  });

  it('T05-11: portfolio endpoints respect organization isolation', async () => {
    const a = await createOwnerOrg('iso-a@example.com', 'Iso A');
    const b = await createOwnerOrg('iso-b@example.com', 'Iso B');

    const propertyA = await properties.createProperty(a.org.id, a.user.id, a.membership.id, {
      code: 'ISO-A',
      name: 'A',
      propertyType: 'MIXED',
      addressLine1: 'A St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    const listedB = await properties.listProperties(b.org.id, b.membership.id);
    expect(listedB.data.find((item) => item.id === propertyA.id)).toBeUndefined();

    await expect(
      properties.getProperty(b.org.id, b.membership.id, propertyA.id),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      authorization.assertPropertyAccess(b.membership.id, b.org.id, propertyA.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('review: PM listProperties cursor keeps grant filter', async () => {
    const { user, org, membership } = await createOwnerOrg(
      'owner-cursor@example.com',
      'Org Cursor',
    );
    const codes = ['C01', 'C02', 'C03', 'OUT'];
    const created = [];
    for (const code of codes) {
      created.push(
        await properties.createProperty(org.id, user.id, membership.id, {
          code,
          name: code,
          propertyType: 'APARTMENT',
          addressLine1: `${code} St`,
          city: 'Austin',
          timeZone: 'UTC',
          defaultCurrency: 'USD',
        }),
      );
    }
    const inScopeIds = created.slice(0, 3).map((item) => item.id);
    const { membership: pmMembership } = await assignPropertyManager(
      org.id,
      membership.id,
      user.id,
      inScopeIds,
    );

    const page1 = await properties.listProperties(org.id, pmMembership.id, { limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.data.every((item) => inScopeIds.includes(item.id))).toBe(true);
    expect(page1.page.nextCursor).not.toBeNull();

    const page2 = await properties.listProperties(org.id, pmMembership.id, {
      limit: 2,
      after: page1.page.nextCursor!,
    });
    expect(page2.data.every((item) => inScopeIds.includes(item.id))).toBe(true);
    expect(page2.data.map((item) => item.id)).not.toContain(created[3]!.id);
  });

  it('review: restore archived property succeeds', async () => {
    const { user, org, membership } = await createOwnerOrg(
      'owner-restore@example.com',
      'Org Restore',
    );
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'RST',
      name: 'Restore Me',
      propertyType: 'APARTMENT',
      addressLine1: '1 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    await properties.archiveProperty(org.id, membership.id, user.id, property.id);
    const restored = await properties.restoreProperty(
      org.id,
      membership.id,
      user.id,
      property.id,
      'pilot restore',
    );
    expect(restored.status).toBe('ACTIVE');
    expect(restored.id).toBe(property.id);
  });

  it('review: PM createProperty auto-grants selected access', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-pm-create@example.com', 'Org PM');
    const seed = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'SEED',
      name: 'Seed',
      propertyType: 'APARTMENT',
      addressLine1: '1 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const { membership: pmMembership, pmUser } = await assignPropertyManager(
      org.id,
      membership.id,
      user.id,
      [seed.id],
    );
    const created = await properties.createProperty(org.id, pmUser.id, pmMembership.id, {
      code: 'NEW-PM',
      name: 'PM Created',
      propertyType: 'APARTMENT',
      addressLine1: '2 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const fetched = await properties.getProperty(org.id, pmMembership.id, created.id);
    expect(fetched.id).toBe(created.id);
  });

  it('review: ownership percentage over 100 is rejected', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-own@example.com', 'Org Own');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'OWN',
      name: 'Owned',
      propertyType: 'APARTMENT',
      addressLine1: '1 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const ownerA = await owners.createOwner(org.id, user.id, {
      partyType: 'PERSON',
      displayName: 'Owner A',
      ownerCategory: 'INDIVIDUAL',
    });
    const ownerB = await owners.createOwner(org.id, user.id, {
      partyType: 'PERSON',
      displayName: 'Owner B',
      ownerCategory: 'INDIVIDUAL',
    });
    await ownerships.createOwnership(org.id, membership.id, user.id, property.id, {
      ownerPartyId: ownerA.id,
      interestType: 'EQUITY',
      ownershipPercentage: '60',
      effectiveFrom: '2024-01-01T00:00:00.000Z',
    });
    await expect(
      ownerships.createOwnership(org.id, membership.id, user.id, property.id, {
        ownerPartyId: ownerB.id,
        interestType: 'EQUITY',
        ownershipPercentage: '50',
        effectiveFrom: '2024-01-01T00:00:00.000Z',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'OWNERSHIP_TOTAL_EXCEEDED' }),
    });
  });

  it('T06-org-wide-units: PM scope + cursor pagination on listUnitsOrgWide', async () => {
    const { user, org, membership } = await createOwnerOrg(
      'owner-t06-units@example.com',
      'Org T06U',
    );
    const inScope = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'IN-U',
      name: 'In Scope Units',
      propertyType: 'APARTMENT',
      addressLine1: '1 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const outScope = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'OUT-U',
      name: 'Out Scope Units',
      propertyType: 'APARTMENT',
      addressLine1: '2 St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    for (let i = 0; i < 3; i += 1) {
      await units.createUnit(org.id, membership.id, user.id, inScope.id, {
        code: `IN-${i}`,
        name: `In ${i}`,
        unitType: 'STUDIO',
        allocationMode: 'WHOLE_UNIT',
        capacity: 1,
      });
    }
    await units.createUnit(org.id, membership.id, user.id, outScope.id, {
      code: 'OUT-0',
      name: 'Out 0',
      unitType: 'STUDIO',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });

    const { membership: pmMembership } = await assignPropertyManager(
      org.id,
      membership.id,
      user.id,
      [inScope.id],
    );

    const page1 = await units.listUnitsOrgWide(org.id, pmMembership.id, { limit: 2 });
    expect(page1.data).toHaveLength(2);
    expect(page1.data.every((unit) => unit.propertyId === inScope.id)).toBe(true);
    expect(page1.page.nextCursor).toBeTruthy();

    const page2 = await units.listUnitsOrgWide(org.id, pmMembership.id, {
      limit: 2,
      after: page1.page.nextCursor!,
    });
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0]!.propertyId).toBe(inScope.id);
    expect(page1.data[0]!.id < page1.data[1]!.id).toBe(true);
    expect(page1.data[1]!.id < page2.data[0]!.id).toBe(true);

    await expect(
      units.listUnitsOrgWide(org.id, pmMembership.id, { propertyId: outScope.id }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const ownerAll = await units.listUnitsOrgWide(org.id, membership.id, { limit: 10 });
    expect(ownerAll.data).toHaveLength(4);
  });
});
