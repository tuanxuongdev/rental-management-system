import { UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { PasswordHasherService } from '../../infrastructure/crypto/crypto.services';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { AuditService } from '../audit/audit.service';
import { UnitService } from '../inventory/application/unit.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

/**
 * T06-08 / T06-09 scale baseline.
 * Uses a reduced count in CI for runtime; set SCALE_TEST_UNIT_COUNT=10000 locally/staging.
 * SLO: org-wide list page (limit 50) p95 under 2000ms on developer DB.
 */
const databaseAvailable = await isDatabaseReachable();
const UNIT_COUNT = Number.parseInt(process.env.SCALE_TEST_UNIT_COUNT ?? '2500', 10);
const LIST_SLO_MS = Number.parseInt(process.env.SCALE_LIST_SLO_MS ?? '2000', 10);

describe.skipIf(!databaseAvailable)('Inventory scale baseline (Sprint-06)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const units = new UnitService(prisma as never, transactions, authorization, audit);

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

  it(`T06-08/09: listUnitsOrgWide under ~${UNIT_COUNT} units meets list SLO`, async () => {
    const passwordHash = await passwords.hashPassword('ValidPassword123!');
    const user = await prisma.user.create({
      data: {
        email: 'scale@example.com',
        normalizedEmail: 'scale@example.com',
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        credentials: { create: { provider: 'LOCAL', passwordHash } },
      },
    });
    const org = await organizations.createOrganization(user.id, { displayName: 'Scale Org' });
    const membership = await prisma.tenantMembership.findFirstOrThrow({
      where: { tenantId: org.id, userId: user.id },
    });

    const property = await prisma.property.create({
      data: {
        tenantId: org.id,
        code: 'SCALE',
        name: 'Scale',
        propertyType: 'APARTMENT',
        addressLine1: '1 Scale',
        city: 'Austin',
        timeZone: 'UTC',
        defaultCurrency: 'USD',
        status: 'ACTIVE',
      },
    });

    const batchSize = 500;
    for (let offset = 0; offset < UNIT_COUNT; offset += batchSize) {
      const slice = Math.min(batchSize, UNIT_COUNT - offset);
      await prisma.unit.createMany({
        data: Array.from({ length: slice }, (_, index) => {
          const n = offset + index + 1;
          return {
            tenantId: org.id,
            propertyId: property.id,
            code: `S-${String(n).padStart(5, '0')}`,
            name: `Unit ${n}`,
            unitType: 'APARTMENT' as const,
            allocationMode: 'WHOLE_UNIT' as const,
            capacity: 1,
            operationalStatus: 'ACTIVE' as const,
            status: 'ACTIVE' as const,
          };
        }),
      });
    }

    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const started = performance.now();
      const page = await units.listUnitsOrgWide(org.id, membership.id, {
        limit: 50,
        q: i % 2 === 0 ? 'S-0001' : undefined,
      });
      samples.push(performance.now() - started);
      expect(page.data.length).toBeGreaterThan(0);
      expect(page.page.limit).toBe(50);
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)]!;
    expect(p95).toBeLessThan(LIST_SLO_MS);
  }, 180_000);
});
