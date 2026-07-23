/**
 * Synthetic 10k+ Unit seed for Sprint-06 scale baseline (T06-08/T06-09).
 *
 * Usage:
 *   DEMO_ORGANIZATION_ID=<uuid> SEED_UNIT_COUNT=10000 pnpm seed:scale-inventory
 *
 * Idempotent on property code SCALE-10K and unit codes U-00001… within that property.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenantId = process.env.DEMO_ORGANIZATION_ID;
  if (!tenantId) {
    throw new Error('DEMO_ORGANIZATION_ID is required');
  }

  const count = Number.parseInt(process.env.SEED_UNIT_COUNT ?? '10000', 10);
  if (!Number.isFinite(count) || count < 1) {
    throw new Error('SEED_UNIT_COUNT must be a positive integer');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (tenant === null) {
    throw new Error(`Organization not found: ${tenantId}`);
  }

  let property = await prisma.property.findFirst({
    where: { tenantId, code: 'SCALE-10K', deletedAt: null },
  });
  if (property === null) {
    property = await prisma.property.create({
      data: {
        tenantId,
        code: 'SCALE-10K',
        name: 'Scale Baseline Property',
        propertyType: 'APARTMENT',
        addressLine1: '10000 Scale Way',
        city: 'Austin',
        region: 'TX',
        postalCode: '78701',
        countryCode: 'US',
        timeZone: 'America/Chicago',
        defaultCurrency: 'USD',
        status: 'ACTIVE',
      },
    });
  }

  const existing = await prisma.unit.count({
    where: { tenantId, propertyId: property.id, deletedAt: null },
  });
  const toCreate = Math.max(0, count - existing);

  const batchSize = 500;
  let created = 0;
  for (let offset = existing; offset < count; offset += batchSize) {
    const slice = Math.min(batchSize, count - offset);
    const data = Array.from({ length: slice }, (_, index) => {
      const n = offset + index + 1;
      const code = `U-${String(n).padStart(5, '0')}`;
      return {
        tenantId,
        propertyId: property!.id,
        code,
        name: `Unit ${code}`,
        unitType: 'APARTMENT' as const,
        allocationMode: 'WHOLE_UNIT' as const,
        capacity: 2,
        operationalStatus: 'ACTIVE' as const,
        status: 'ACTIVE' as const,
      };
    });
    await prisma.unit.createMany({ data, skipDuplicates: true });
    created += slice;
  }

  // eslint-disable-next-line no-console -- seed CLI
  console.log(
    JSON.stringify(
      {
        organizationId: tenantId,
        propertyCode: property.code,
        unitTarget: count,
        previouslyExisting: existing,
        attemptedCreate: toCreate,
        batchesWritten: created,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
