import { PrismaClient } from '@prisma/client';

const DEFAULT_DATABASE_URL = 'postgresql://rpm:rpm@localhost:5433/rpm?schema=public';

export function getIntegrationDatabaseUrl(): string {
  return process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
}

export function createIntegrationPrismaClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: getIntegrationDatabaseUrl(),
      },
    },
  });
}

export async function isDatabaseReachable(): Promise<boolean> {
  const prisma = createIntegrationPrismaClient();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

export async function resetPlatformTables(prisma: PrismaClient): Promise<void> {
  // Sprint-07 documents / residents first (FK to parties/properties/tenants)
  await prisma.documentLink.deleteMany();
  await prisma.documentVersion.deleteMany();
  await prisma.document.deleteMany();
  await prisma.doNotRentFlag.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.partyIdentifier.deleteMany();
  await prisma.residentProfile.deleteMany();

  // Import/export first (FK to tenants)
  await prisma.importJobRow.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.exportJob.deleteMany();
  await prisma.importMappingPreset.deleteMany();

  // Inventory / parties children first (FK order), then RBAC, then tenancy/identity
  await prisma.inventoryStatusHistory.deleteMany();
  await prisma.unitAmenity.deleteMany();
  await prisma.propertyAmenity.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.ratePlan.deleteMany();
  await prisma.unitType.deleteMany();
  await prisma.amenity.deleteMany();
  await prisma.managementAgreementParty.deleteMany();
  await prisma.managementAgreement.deleteMany();
  await prisma.propertyOwnership.deleteMany();
  await prisma.ownerProfile.deleteMany();
  await prisma.partyContact.deleteMany();
  await prisma.party.deleteMany();
  await prisma.property.deleteMany();

  // RBAC child tables first (membership_roles Restrict on roles)
  await prisma.privilegedAccessEvent.deleteMany();
  await prisma.propertyAccessGrant.deleteMany();
  await prisma.membershipRole.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();

  await prisma.auditEvent.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.tenantMembership.deleteMany();
  await prisma.tenantSetting.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.oneTimeToken.deleteMany();
  await prisma.mfaMethod.deleteMany();
  await prisma.userCredential.deleteMany();
  await prisma.user.deleteMany();
  await prisma.processedMessage.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.outboxEvent.deleteMany();
  await prisma.scheduledJob.deleteMany();
}
