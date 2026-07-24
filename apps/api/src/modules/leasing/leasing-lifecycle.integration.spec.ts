import { randomUUID } from 'node:crypto';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { type ActivateLeaseRequest, SYSTEM_ROLE_KEYS } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { PasswordHasherService } from '../../infrastructure/crypto/crypto.services';
import { IdempotencyService } from '../../infrastructure/idempotency/idempotency.service';
import { OutboxService } from '../../infrastructure/outbox/outbox.service';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { AuditService } from '../audit/audit.service';
import { DepositService } from '../billing/application/deposit.service';
import { PropertyService } from '../inventory/application/property.service';
import { UnitService } from '../inventory/application/unit.service';
import { ResidentService } from '../residents/application/resident.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { LeaseLifecycleService } from './application/lease-lifecycle.service';
import { LeaseService } from './application/lease.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Lease lifecycle (Sprint-09)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const properties = new PropertyService(prisma as never, transactions, authorization, audit);
  const units = new UnitService(prisma as never, transactions, authorization, audit);
  const residents = new ResidentService(prisma as never, transactions, authorization, audit);
  const outbox = new OutboxService(prisma as never);
  const idempotency = new IdempotencyService(prisma as never);
  const deposits = new DepositService(prisma as never, authorization, outbox);
  const leases = new LeaseService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    deposits,
  );
  const lifecycle = new LeaseLifecycleService(
    prisma as never,
    transactions,
    authorization,
    audit,
    outbox,
    idempotency,
    leases,
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

  async function createOwnerOrg(email: string, name: string) {
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        credentials: {
          create: {
            id: randomUUID(),
            passwordHash: await passwords.hash('Password123!'),
          },
        },
      },
    });
    const org = await organizations.createOrganization(user.id, {
      name,
      slug: `org-${randomUUID().slice(0, 8)}`,
      defaultCurrency: 'USD',
      timeZone: 'UTC',
    });
    const membership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: user.id, status: MembershipStatus.ACTIVE },
    });
    return { user, org, membership };
  }

  async function seedActivatedLease(orgId: string, userId: string, membershipId: string) {
    const property = await properties.createProperty(orgId, userId, membershipId, {
      code: `P-${randomUUID().slice(0, 8)}`,
      name: 'Lifecycle House',
      propertyType: 'BOARDING_HOUSE',
      addressLine1: '9 Life St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const unit = await units.createUnit(orgId, membershipId, userId, property.id, {
      code: 'U1',
      name: 'Unit 1',
      unitType: 'APARTMENT',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });
    const resident = await residents.createResident(orgId, membershipId, userId, {
      displayName: 'Lifecycle Resident',
      preferredPropertyId: property.id,
      contacts: [{ type: 'email', value: `life-${randomUUID().slice(0, 8)}@example.com` }],
    });
    const draft = await leases.createLease(orgId, membershipId, userId, {
      propertyId: property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: unit.id, allocationType: 'WHOLE_UNIT' },
    });
    const body: ActivateLeaseRequest = { checklistAcknowledged: true };
    const hash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${orgId}/leases/${draft.id}/activate`,
      body,
    );
    const activated = await leases.activateLease(
      orgId,
      membershipId,
      userId,
      draft.id,
      body,
      draft.version,
      randomUUID(),
      hash,
    );
    return { property, unit, resident, lease: activated.body };
  }

  it('T09-01: move-in happy path', async () => {
    const { user, org, membership } = await createOwnerOrg('t0901@example.com', 'Org T0901');
    const seeded = await seedActivatedLease(org.id, user.id, membership.id);
    const hash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${org.id}/leases/${seeded.lease.id}/move-in`,
      { checklistAcknowledged: true },
    );
    const moved = await lifecycle.moveIn(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      { checklistAcknowledged: true, assetCheckouts: [{ label: 'Key A' }] },
      seeded.lease.version,
      randomUUID(),
      hash,
    );
    expect(moved.body.occupancyState).toBe('OCCUPIED');
    expect(
      await prisma.occupancyEvent.count({ where: { leaseId: seeded.lease.id } }),
    ).toBeGreaterThan(0);
  });

  it('T09-02: move-in twice rejected', async () => {
    const { user, org, membership } = await createOwnerOrg('t0902@example.com', 'Org T0902');
    const seeded = await seedActivatedLease(org.id, user.id, membership.id);
    const body = { checklistAcknowledged: true as const };
    const hash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${org.id}/leases/${seeded.lease.id}/move-in`,
      body,
    );
    const first = await lifecycle.moveIn(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      body,
      seeded.lease.version,
      randomUUID(),
      hash,
    );
    await expect(
      lifecycle.moveIn(
        org.id,
        membership.id,
        user.id,
        seeded.lease.id,
        body,
        first.body.version,
        randomUUID(),
        hash,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T09-03: renew without overlap creates draft', async () => {
    const { user, org, membership } = await createOwnerOrg('t0903@example.com', 'Org T0903');
    const seeded = await seedActivatedLease(org.id, user.id, membership.id);
    const renewal = await lifecycle.renew(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      { startDate: '2027-08-01', endDate: '2028-07-31', copyAllocation: true, copyParties: true },
      seeded.lease.version,
    );
    expect(renewal.status).toBe('DRAFT');
    expect(renewal.renewedFromLeaseId).toBe(seeded.lease.id);
  });

  it('T09-04: transfer rejects overlapping target allocation', async () => {
    const { user, org, membership } = await createOwnerOrg('t0904@example.com', 'Org T0904');
    const first = await seedActivatedLease(org.id, user.id, membership.id);
    const unit2 = await units.createUnit(org.id, membership.id, user.id, first.property.id, {
      code: 'U2',
      name: 'Unit 2',
      unitType: 'APARTMENT',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });
    const resident2 = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Other Resident',
      preferredPropertyId: first.property.id,
      contacts: [{ type: 'email', value: `other-${randomUUID().slice(0, 8)}@example.com` }],
    });
    const draft2 = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: first.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: resident2.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: unit2.id, allocationType: 'WHOLE_UNIT' },
    });
    const activateBody: ActivateLeaseRequest = { checklistAcknowledged: true };
    const activateHash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${org.id}/leases/${draft2.id}/activate`,
      activateBody,
    );
    await leases.activateLease(
      org.id,
      membership.id,
      user.id,
      draft2.id,
      activateBody,
      draft2.version,
      randomUUID(),
      activateHash,
    );

    await expect(
      lifecycle.transfer(
        org.id,
        membership.id,
        user.id,
        first.lease.id,
        {
          allocation: { unitId: unit2.id, allocationType: 'WHOLE_UNIT' },
          reason: 'Move to occupied unit',
        },
        first.lease.version,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T09-05: move-out complete emits occupancy moved out', async () => {
    const { user, org, membership } = await createOwnerOrg('t0905@example.com', 'Org T0905');
    const seeded = await seedActivatedLease(org.id, user.id, membership.id);
    const moveInHash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${org.id}/leases/${seeded.lease.id}/move-in`,
      { checklistAcknowledged: true },
    );
    const moved = await lifecycle.moveIn(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      { checklistAcknowledged: true, assetCheckouts: [{ label: 'Key A' }] },
      seeded.lease.version,
      randomUUID(),
      moveInHash,
    );
    const started = await lifecycle.startMoveOut(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      {},
      moved.body.version,
    );
    const patched = await lifecycle.patchMoveOut(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      {
        checklist: [
          { key: 'condition', label: 'Unit/bed condition reviewed', completed: true },
          { key: 'keys', label: 'Keys returned or reconciled', completed: true },
          {
            key: 'readings',
            label: 'Final meter reading values captured (checklist)',
            completed: true,
          },
          {
            key: 'deposit_preview',
            label: 'Deposit disposition preview recorded (pending finance)',
            completed: true,
          },
        ],
        returnAllIssuedKeys: true,
      },
      started.version,
    );
    const completeBody = {
      checklistAcknowledged: true as const,
      confirmation: true as const,
      keysReconciled: true as const,
    };
    const completeHash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${org.id}/leases/${seeded.lease.id}/move-out/complete`,
      completeBody,
    );
    const completed = await lifecycle.completeMoveOut(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      completeBody,
      patched.version,
      randomUUID(),
      completeHash,
    );
    expect(completed.body.occupancyState).toBe('MOVED_OUT');
    expect(
      await prisma.assetKey.count({
        where: { leaseId: seeded.lease.id, status: 'ISSUED' },
      }),
    ).toBe(0);

    const termBody = {
      reason: 'End of tenancy',
      confirmation: true as const,
    };
    const termHash = idempotency.hashRequest(
      'POST',
      `/v1/organizations/${org.id}/leases/${seeded.lease.id}/terminate`,
      termBody,
    );
    const ended = await lifecycle.terminate(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      termBody,
      completed.body.version,
      randomUUID(),
      termHash,
    );
    expect(ended.body.status).toBe('ENDED');
  });

  it('T09-05b: complete move-out blocked while keys remain issued', async () => {
    const { user, org, membership } = await createOwnerOrg('t0905b@example.com', 'Org T0905b');
    const seeded = await seedActivatedLease(org.id, user.id, membership.id);
    const moved = await lifecycle.moveIn(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      { checklistAcknowledged: true, assetCheckouts: [{ label: 'Key B' }] },
      seeded.lease.version,
      randomUUID(),
      'hash-mi',
    );
    const started = await lifecycle.startMoveOut(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      {},
      moved.body.version,
    );
    const patched = await lifecycle.patchMoveOut(
      org.id,
      membership.id,
      user.id,
      seeded.lease.id,
      {
        checklist: [
          { key: 'condition', label: 'Unit/bed condition reviewed', completed: true },
          { key: 'keys', label: 'Keys returned or reconciled', completed: true },
          {
            key: 'readings',
            label: 'Final meter reading values captured (checklist)',
            completed: true,
          },
          {
            key: 'deposit_preview',
            label: 'Deposit disposition preview recorded (pending finance)',
            completed: true,
          },
        ],
      },
      started.version,
    );
    await expect(
      lifecycle.completeMoveOut(
        org.id,
        membership.id,
        user.id,
        seeded.lease.id,
        {
          checklistAcknowledged: true,
          confirmation: true,
          keysReconciled: true,
        },
        patched.version,
        randomUUID(),
        'hash-co',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T09-06: terminate without reason fails schema', async () => {
    const { terminateLeaseRequestSchema } = await import('@rpm/contracts');
    expect(() => terminateLeaseRequestSchema.parse({ confirmation: true })).toThrow();
  });

  it('T09-07: pending-actions includes move-in due', async () => {
    const { user, org, membership } = await createOwnerOrg('t0907@example.com', 'Org T0907');
    await seedActivatedLease(org.id, user.id, membership.id);
    const pending = await lifecycle.listPendingActions(org.id, membership.id);
    expect(pending.data.some((row) => row.kind === 'MOVE_IN_DUE')).toBe(true);
  });

  it('T09-08: cross-org lifecycle 404', async () => {
    const a = await createOwnerOrg('t0908a@example.com', 'Org A');
    const b = await createOwnerOrg('t0908b@example.com', 'Org B');
    const seeded = await seedActivatedLease(a.org.id, a.user.id, a.membership.id);
    await expect(
      lifecycle.moveIn(
        b.org.id,
        b.membership.id,
        b.user.id,
        seeded.lease.id,
        { checklistAcknowledged: true },
        1,
        randomUUID(),
        'hash',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T09-09: property scope denial', async () => {
    const { user, org, membership } = await createOwnerOrg('t0909@example.com', 'Org T0909');
    const seeded = await seedActivatedLease(org.id, user.id, membership.id);
    const outProperty = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'OUT',
      name: 'Out',
      propertyType: 'APARTMENT',
      addressLine1: '1 Out',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const pmUser = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'pm-t0909@example.com',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
    const pmMembership = await prisma.tenantMembership.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        userId: pmUser.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    const pmRole = await prisma.role.findFirstOrThrow({
      where: { tenantId: org.id, key: SYSTEM_ROLE_KEYS.PROPERTY_MANAGER },
    });
    await prisma.membershipRole.create({
      data: { id: randomUUID(), membershipId: pmMembership.id, roleId: pmRole.id },
    });
    await prisma.propertyAccessGrant.create({
      data: {
        id: randomUUID(),
        tenantId: org.id,
        membershipId: pmMembership.id,
        propertyId: outProperty.id,
        scopeType: 'SELECTED_PROPERTIES',
      },
    });
    await expect(
      lifecycle.moveIn(
        org.id,
        pmMembership.id,
        pmUser.id,
        seeded.lease.id,
        { checklistAcknowledged: true },
        seeded.lease.version,
        randomUUID(),
        'hash',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T09-11: home dashboard returns finance note', async () => {
    const { user, org, membership } = await createOwnerOrg('t0911@example.com', 'Org T0911');
    await seedActivatedLease(org.id, user.id, membership.id);
    const home = await lifecycle.getHomeDashboard(org.id, membership.id);
    expect(home.financeNote).toContain('Finance');
    expect(home.moveInsDue).toBeGreaterThanOrEqual(1);
  });
});
