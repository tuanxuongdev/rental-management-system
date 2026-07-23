/**
 * Synthetic demo portfolio for Sprint-05 local/staging demos.
 *
 * Prerequisites:
 * - Migrated database
 * - An existing Organization (tenant) id via DEMO_ORGANIZATION_ID
 *
 * Usage:
 *   DEMO_ORGANIZATION_ID=<uuid> pnpm seed:demo-portfolio
 *
 * Idempotent on property/unit/bed codes within the target organization.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const tenantId = process.env.DEMO_ORGANIZATION_ID;
  if (!tenantId) {
    throw new Error('DEMO_ORGANIZATION_ID is required');
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (tenant === null) {
    throw new Error(`Organization not found: ${tenantId}`);
  }

  let apartment = await prisma.property.findFirst({
    where: { tenantId, code: 'DEMO-APT', deletedAt: null },
  });
  if (apartment === null) {
    apartment = await prisma.property.create({
      data: {
        tenantId,
        code: 'DEMO-APT',
        name: 'Demo Apartment Court',
        propertyType: 'APARTMENT',
        addressLine1: '100 Demo Avenue',
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

  let boarding = await prisma.property.findFirst({
    where: { tenantId, code: 'DEMO-BH', deletedAt: null },
  });
  if (boarding === null) {
    boarding = await prisma.property.create({
      data: {
        tenantId,
        code: 'DEMO-BH',
        name: 'Demo Boarding House',
        propertyType: 'BOARDING_HOUSE',
        addressLine1: '200 Shared Street',
        city: 'Austin',
        region: 'TX',
        postalCode: '78702',
        countryCode: 'US',
        timeZone: 'America/Chicago',
        defaultCurrency: 'USD',
        status: 'ACTIVE',
      },
    });
  }

  let building = await prisma.building.findFirst({
    where: { tenantId, propertyId: apartment.id, code: 'A', deletedAt: null },
  });
  if (building === null) {
    building = await prisma.building.create({
      data: {
        tenantId,
        propertyId: apartment.id,
        code: 'A',
        name: 'Building A',
        sortOrder: 1,
        status: 'ACTIVE',
      },
    });
  }

  let wholeUnit = await prisma.unit.findFirst({
    where: { tenantId, propertyId: apartment.id, code: '101', deletedAt: null },
  });
  if (wholeUnit === null) {
    wholeUnit = await prisma.unit.create({
      data: {
        tenantId,
        propertyId: apartment.id,
        buildingId: building.id,
        code: '101',
        name: 'Apartment 101',
        unitType: 'APARTMENT',
        allocationMode: 'WHOLE_UNIT',
        capacity: 2,
        operationalStatus: 'ACTIVE',
        status: 'ACTIVE',
      },
    });
  }

  let sharedUnit = await prisma.unit.findFirst({
    where: { tenantId, propertyId: boarding.id, code: 'SR-1', deletedAt: null },
  });
  if (sharedUnit === null) {
    sharedUnit = await prisma.unit.create({
      data: {
        tenantId,
        propertyId: boarding.id,
        code: 'SR-1',
        name: 'Shared Room 1',
        unitType: 'SHARED_ROOM',
        allocationMode: 'BED',
        capacity: 2,
        operationalStatus: 'ACTIVE',
        status: 'ACTIVE',
      },
    });
  }

  for (const bed of [
    { code: 'B1', label: 'Bed 1' },
    { code: 'B2', label: 'Bed 2' },
  ]) {
    const existing = await prisma.bed.findFirst({
      where: { tenantId, unitId: sharedUnit.id, code: bed.code, deletedAt: null },
    });
    if (existing === null) {
      await prisma.bed.create({
        data: {
          tenantId,
          unitId: sharedUnit.id,
          code: bed.code,
          label: bed.label,
          operationalStatus: 'ACTIVE',
          status: 'ACTIVE',
        },
      });
    }
  }

  let owner = await prisma.party.findFirst({
    where: { tenantId, displayName: 'Demo Property Owner', deletedAt: null },
  });
  if (owner === null) {
    owner = await prisma.party.create({
      data: {
        tenantId,
        partyType: 'PERSON',
        displayName: 'Demo Property Owner',
        legalName: 'Demo Property Owner LLC Contact',
        status: 'ACTIVE',
      },
    });
  }

  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { partyId: owner.id } });
  if (ownerProfile === null) {
    await prisma.ownerProfile.create({
      data: {
        tenantId,
        partyId: owner.id,
        ownerCategory: 'INDIVIDUAL',
        notes: 'Synthetic owner — does not grant login access',
      },
    });
  }

  const existingOwnership = await prisma.propertyOwnership.findFirst({
    where: { tenantId, propertyId: apartment.id, ownerPartyId: owner.id, status: 'ACTIVE' },
  });
  if (existingOwnership === null) {
    await prisma.propertyOwnership.create({
      data: {
        tenantId,
        propertyId: apartment.id,
        ownerPartyId: owner.id,
        interestType: 'EQUITY',
        ownershipPercentage: 100,
        effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
        status: 'ACTIVE',
      },
    });
  }

  const existingAgreement = await prisma.managementAgreement.findFirst({
    where: { tenantId, propertyId: boarding.id, agreementNumber: 'DEMO-MA-001' },
  });
  if (existingAgreement === null) {
    const agreement = await prisma.managementAgreement.create({
      data: {
        tenantId,
        propertyId: boarding.id,
        agreementNumber: 'DEMO-MA-001',
        status: 'ACTIVE',
        effectiveFrom: new Date('2024-01-01T00:00:00.000Z'),
        notes: 'Synthetic management agreement — does not grant RBAC',
      },
    });
    await prisma.managementAgreementParty.create({
      data: {
        tenantId,
        agreementId: agreement.id,
        partyId: owner.id,
        role: 'OWNER',
      },
    });
  }

  const wifi = await prisma.amenity.findUnique({
    where: { tenantId_code: { tenantId, code: 'WIFI' } },
  });
  if (wifi === null) {
    await prisma.amenity.create({
      data: {
        tenantId,
        code: 'WIFI',
        name: 'Wi-Fi',
        category: 'CONNECTIVITY',
        status: 'ACTIVE',
      },
    });
  }

  // eslint-disable-next-line no-console -- seed CLI output
  console.log(
    JSON.stringify(
      {
        organizationId: tenantId,
        properties: [apartment.code, boarding.code],
        units: [wholeUnit.code, sharedUnit.code],
        note: 'Property Owner records do not grant application login access',
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console -- seed CLI output
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
