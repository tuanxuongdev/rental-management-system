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
