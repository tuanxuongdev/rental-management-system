import { randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  type ActivateLeaseRequest,
  LEASE_ACTIVATED_EVENT_TYPE,
  type SetLeaseAllocationRequest,
  SYSTEM_ROLE_KEYS,
} from '@rpm/contracts';
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
import { BedService } from '../inventory/application/bed.service';
import { PropertyService } from '../inventory/application/property.service';
import { UnitService } from '../inventory/application/unit.service';
import { ResidentService } from '../residents/application/resident.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { LeaseService } from './application/lease.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Leasing isolation (Sprint-08)', () => {
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

  async function seedPortfolio(orgId: string, userId: string, membershipId: string) {
    const property = await properties.createProperty(orgId, userId, membershipId, {
      code: `P-${randomUUID().slice(0, 8)}`,
      name: 'Lease House',
      propertyType: 'BOARDING_HOUSE',
      addressLine1: '8 Lease St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const wholeUnit = await units.createUnit(orgId, membershipId, userId, property.id, {
      code: 'U-WHOLE',
      name: 'Whole Unit',
      unitType: 'APARTMENT',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });
    const bedUnit = await units.createUnit(orgId, membershipId, userId, property.id, {
      code: 'U-BED',
      name: 'Shared Room',
      unitType: 'SHARED_ROOM',
      allocationMode: 'BED',
      capacity: 2,
    });
    const bedA = await beds.createBed(orgId, membershipId, userId, bedUnit.id, {
      code: 'B1',
      label: 'Bed 1',
    });
    const bedB = await beds.createBed(orgId, membershipId, userId, bedUnit.id, {
      code: 'B2',
      label: 'Bed 2',
    });
    const capacityUnit = await units.createUnit(orgId, membershipId, userId, property.id, {
      code: 'U-CAP',
      name: 'Capacity Unit',
      unitType: 'SHARED_ROOM',
      allocationMode: 'CAPACITY',
      capacity: 2,
    });
    const resident = await residents.createResident(orgId, membershipId, userId, {
      displayName: 'Lease Resident',
      preferredPropertyId: property.id,
      contacts: [{ type: 'email', value: `resident-${randomUUID().slice(0, 8)}@example.com` }],
    });
    return { property, wholeUnit, bedUnit, bedA, bedB, capacityUnit, resident };
  }

  function activateBody(
    overrides?: Partial<Omit<ActivateLeaseRequest, 'checklistAcknowledged'>>,
  ): ActivateLeaseRequest {
    return { checklistAcknowledged: true, ...overrides };
  }

  async function activateLeaseTest(
    orgId: string,
    membershipId: string,
    userId: string,
    leaseId: string,
    version: number,
    idempotencyKey = randomUUID(),
    body: ActivateLeaseRequest = activateBody(),
  ) {
    const operationPath = `/v1/organizations/${orgId}/leases/${leaseId}/activate`;
    const requestHash = idempotency.hashRequest('POST', operationPath, body);
    return leases.activateLease(
      orgId,
      membershipId,
      userId,
      leaseId,
      body,
      version,
      idempotencyKey,
      requestHash,
    );
  }

  async function setAllocationTest(
    orgId: string,
    membershipId: string,
    userId: string,
    leaseId: string,
    body: SetLeaseAllocationRequest,
    version: number,
    idempotencyKey = randomUUID(),
  ) {
    const operationPath = `/v1/organizations/${orgId}/leases/${leaseId}/allocations`;
    const requestHash = idempotency.hashRequest('POST', operationPath, body);
    return leases.setAllocation(
      orgId,
      membershipId,
      userId,
      leaseId,
      body,
      version,
      idempotencyKey,
      requestHash,
    );
  }

  it('T08-01: draft lease happy path', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0801@example.com', 'Org T0801');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);

    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '500.00',
      depositAmount: '500.00',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: {
        unitId: portfolio.wholeUnit.id,
        allocationType: 'WHOLE_UNIT',
      },
    });

    expect(draft.status).toBe('DRAFT');
    expect(draft.terms?.rentAmount).toBe('500');
    expect(draft.allocations).toHaveLength(1);
    expect(draft.occupancyNote).toContain('Sprint-09');
  });

  it('T08-02: activate non-overlapping writes history + outbox', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0802@example.com', 'Org T0802');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '600',
      depositAmount: '600',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    const activated = await activateLeaseTest(
      org.id,
      membership.id,
      user.id,
      draft.id,
      draft.version,
    );

    expect(activated.replayed).toBe(false);
    expect(activated.body.status).toBe('ACTIVE');
    expect(activated.body.leaseNumber).toMatch(/^L-/);

    const history = await leases.getHistory(org.id, membership.id, draft.id);
    expect(history.data.some((row) => row.toStatus === 'ACTIVE')).toBe(true);

    const events = await prisma.outboxEvent.findMany({
      where: { aggregateId: draft.id, eventType: LEASE_ACTIVATED_EVENT_TYPE },
    });
    expect(events).toHaveLength(1);
  });

  it('T08-03: overlapping BED allocation rejected', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0803@example.com', 'Org T0803');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const r2 = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Second',
      preferredPropertyId: portfolio.property.id,
    });

    await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: {
        unitId: portfolio.bedUnit.id,
        bedId: portfolio.bedA.id,
        allocationType: 'BED',
      },
    });

    await expect(
      leases.createLease(org.id, membership.id, user.id, {
        propertyId: portfolio.property.id,
        currency: 'USD',
        startDate: '2026-09-01',
        endDate: '2027-08-31',
        rentAmount: '100',
        depositAmount: '100',
        parties: [{ partyId: r2.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
        allocation: {
          unitId: portfolio.bedUnit.id,
          bedId: portfolio.bedA.id,
          allocationType: 'BED',
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T08-04: overlapping WHOLE_UNIT rejected', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0804@example.com', 'Org T0804');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const r2 = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Second',
      preferredPropertyId: portfolio.property.id,
    });

    await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    await expect(
      leases.createLease(org.id, membership.id, user.id, {
        propertyId: portfolio.property.id,
        currency: 'USD',
        startDate: '2026-10-01',
        endDate: '2027-09-30',
        rentAmount: '100',
        depositAmount: '100',
        parties: [{ partyId: r2.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
        allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T08-05: capacity overflow rejected', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0805@example.com', 'Org T0805');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const r2 = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Second',
      preferredPropertyId: portfolio.property.id,
    });
    const r3 = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Third',
      preferredPropertyId: portfolio.property.id,
    });

    await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: {
        unitId: portfolio.capacityUnit.id,
        allocationType: 'CAPACITY',
        capacityQuantity: 2,
      },
    });

    await expect(
      leases.createLease(org.id, membership.id, user.id, {
        propertyId: portfolio.property.id,
        currency: 'USD',
        startDate: '2026-08-15',
        endDate: '2027-07-31',
        rentAmount: '100',
        depositAmount: '100',
        parties: [{ partyId: r2.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
        allocation: {
          unitId: portfolio.capacityUnit.id,
          allocationType: 'CAPACITY',
          capacityQuantity: 1,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    void r3;
  });

  it('T08-06: two concurrent activates same bed — exactly one success', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0806@example.com', 'Org T0806');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const r2 = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Second',
      preferredPropertyId: portfolio.property.id,
    });

    const draft1 = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: {
        unitId: portfolio.bedUnit.id,
        bedId: portfolio.bedA.id,
        allocationType: 'BED',
      },
    });

    const draft2 = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '110',
      depositAmount: '110',
      parties: [{ partyId: r2.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
    });

    const bedAllocation = {
      unitId: portfolio.bedUnit.id,
      bedId: portfolio.bedA.id,
      allocationType: 'BED' as const,
    };

    const results = await Promise.allSettled([
      activateLeaseTest(org.id, membership.id, user.id, draft1.id, draft1.version, 'key-a'),
      (async () => {
        await setAllocationTest(
          org.id,
          membership.id,
          user.id,
          draft2.id,
          bedAllocation,
          draft2.version,
        );
        const refreshed = await leases.getLease(org.id, membership.id, draft2.id);
        return activateLeaseTest(
          org.id,
          membership.id,
          user.id,
          refreshed.id,
          refreshed.version,
          'key-b',
        );
      })(),
    ]);

    const successes = results.filter((row) => row.status === 'fulfilled');
    const failures = results.filter((row) => row.status === 'rejected');
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);

    const activeCount = await prisma.lease.count({
      where: { tenantId: org.id, status: 'ACTIVE', deletedAt: null },
    });
    expect(activeCount).toBe(1);
  });

  it('T08-07: stale If-Match activate returns 412', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0807@example.com', 'Org T0807');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    await expect(
      activateLeaseTest(org.id, membership.id, user.id, draft.id, draft.version - 1),
    ).rejects.toBeInstanceOf(PreconditionFailedException);
  });

  it('T08-08: do-not-rent without override blocked', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0808@example.com', 'Org T0808');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    await residents.setDoNotRent(org.id, membership.id, user.id, portfolio.resident.id, {
      reason: 'Prior damage',
    });

    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    await expect(
      activateLeaseTest(org.id, membership.id, user.id, draft.id, draft.version),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T08-08b: do-not-rent with Owner override succeeds', async () => {
    const { user, org, membership } = await createOwnerOrg(
      'owner-t0808b@example.com',
      'Org T0808b',
    );
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    await residents.setDoNotRent(org.id, membership.id, user.id, portfolio.resident.id, {
      reason: 'Prior damage',
    });

    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    const review = await leases.reviewLease(org.id, membership.id, draft.id);
    expect(review.ready).toBe(false);
    expect(review.issues.some((issue) => issue.code === 'DO_NOT_RENT_ACTIVE')).toBe(true);

    const activated = await activateLeaseTest(
      org.id,
      membership.id,
      user.id,
      draft.id,
      draft.version,
      randomUUID(),
      activateBody({
        overrideDoNotRent: true,
        overrideReason: 'Accepted residual risk after review',
      }),
    );
    expect(activated.body.status).toBe('ACTIVE');
  });

  it('T08-09: cross-org lease id returns 404', async () => {
    const a = await createOwnerOrg('owner-t0809a@example.com', 'Org A');
    const b = await createOwnerOrg('owner-t0809b@example.com', 'Org B');
    const portfolio = await seedPortfolio(a.org.id, a.user.id, a.membership.id);
    const draft = await leases.createLease(a.org.id, a.membership.id, a.user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    await expect(leases.getLease(b.org.id, b.membership.id, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('T08-10: Property Manager out of scope denied', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0810@example.com', 'Org T0810');
    const inScope = await seedPortfolio(org.id, user.id, membership.id);
    const outProperty = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'OUT',
      name: 'Out',
      propertyType: 'APARTMENT',
      addressLine1: '9 Out',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const { membership: pmMembership } = await assignPropertyManager(org.id, [inScope.property.id]);

    await expect(
      leases.createLease(org.id, pmMembership.id, user.id, {
        propertyId: outProperty.id,
        currency: 'USD',
        startDate: '2026-08-01',
        endDate: '2027-07-31',
        rentAmount: '100',
        depositAmount: '100',
        parties: [{ partyId: inScope.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const outUnit = await units.createUnit(org.id, membership.id, user.id, outProperty.id, {
      code: 'OUT-1',
      name: 'Out 1',
      unitType: 'APARTMENT',
      allocationMode: 'WHOLE_UNIT',
      capacity: 1,
    });

    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: outProperty.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: inScope.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: {
        unitId: outUnit.id,
        allocationType: 'WHOLE_UNIT',
      },
    });

    await expect(leases.getLease(org.id, pmMembership.id, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      activateLeaseTest(org.id, pmMembership.id, user.id, draft.id, draft.version),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T08-11: idempotent activate replay', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0811@example.com', 'Org T0811');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });
    const key = `idem-replay-${randomUUID()}`;
    const body = activateBody();
    const first = await activateLeaseTest(
      org.id,
      membership.id,
      user.id,
      draft.id,
      draft.version,
      key,
      body,
    );
    const second = await activateLeaseTest(
      org.id,
      membership.id,
      user.id,
      draft.id,
      first.body.version,
      key,
      body,
    );
    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(second.body.id).toBe(first.body.id);
    expect(
      await prisma.leaseAllocation.count({ where: { leaseId: draft.id, status: 'ACTIVE' } }),
    ).toBe(1);
  });

  it('T08-12: isolation suite lease endpoints cross-org denial', async () => {
    const a = await createOwnerOrg('owner-t0812a@example.com', 'Org A12');
    const b = await createOwnerOrg('owner-t0812b@example.com', 'Org B12');
    const portfolio = await seedPortfolio(a.org.id, a.user.id, a.membership.id);
    const draft = await leases.createLease(a.org.id, a.membership.id, a.user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });

    await expect(leases.reviewLease(b.org.id, b.membership.id, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(leases.getLease(b.org.id, b.membership.id, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      leases.listLeases(b.org.id, b.membership.id, { limit: 20 }),
    ).resolves.toMatchObject({ data: [] });
    await expect(
      setAllocationTest(
        b.org.id,
        b.membership.id,
        b.user.id,
        draft.id,
        { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
        draft.version,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      activateLeaseTest(b.org.id, b.membership.id, b.user.id, draft.id, 1),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(leases.getHistory(b.org.id, b.membership.id, draft.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('T08-13: EXCLUDE constraints present', async () => {
    const rows = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint
      WHERE conname IN ('lease_allocations_whole_unit_excl', 'lease_allocations_bed_excl')
    `;
    expect(rows.map((row) => row.conname).sort()).toEqual([
      'lease_allocations_bed_excl',
      'lease_allocations_whole_unit_excl',
    ]);
  });

  it('review blocks activate without checklist', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t08chk@example.com', 'Org CHK');
    const portfolio = await seedPortfolio(org.id, user.id, membership.id);
    const draft = await leases.createLease(org.id, membership.id, user.id, {
      propertyId: portfolio.property.id,
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '100',
      depositAmount: '100',
      parties: [{ partyId: portfolio.resident.id, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation: { unitId: portfolio.wholeUnit.id, allocationType: 'WHOLE_UNIT' },
    });
    await expect(
      activateLeaseTest(org.id, membership.id, user.id, draft.id, draft.version, randomUUID(), {
        checklistAcknowledged: false,
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
