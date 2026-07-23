/**
 * Demo residents + sample document metadata for Sprint-07 staging demos.
 * Usage: pnpm seed:demo-residents
 * Requires an existing Organization (creates one owner org if DEMO_ORG_SLUG unset uses seed org).
 */
import { createHash, randomUUID } from 'node:crypto';

import {
  DocumentStatus,
  DocumentVisibility,
  MembershipStatus,
  PartyType,
  PrismaClient,
  ResidentStatus,
  UserStatus,
  WaitlistEntryStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

function lookupHash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

async function main(): Promise<void> {
  const org = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  });
  if (org === null) {
    throw new Error(
      'No active Organization found. Create an org (Sprint-03) before seeding residents.',
    );
  }

  const actor = await prisma.user.findFirst({
    where: { status: UserStatus.ACTIVE },
    orderBy: { createdAt: 'asc' },
  });
  if (actor === null) {
    throw new Error('No active user found to attribute seed documents.');
  }

  const property = await prisma.property.findFirst({
    where: { tenantId: org.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });

  const email = 'demo.resident@example.com';
  const existing = await prisma.partyContact.findFirst({
    where: { tenantId: org.id, type: 'EMAIL', value: email },
  });
  if (existing !== null) {
    console.log(`Demo resident already present for ${org.displayName}; skipping.`);
    return;
  }

  const party = await prisma.party.create({
    data: {
      tenantId: org.id,
      partyType: PartyType.PERSON,
      displayName: 'Alex Resident',
      legalName: 'Alexandra Resident',
      contacts: {
        create: [
          {
            tenantId: org.id,
            type: 'EMAIL',
            value: email,
            purpose: 'PRIMARY',
            isPreferred: true,
          },
          {
            tenantId: org.id,
            type: 'PHONE',
            value: '+15555550107',
            purpose: 'MOBILE',
            isPreferred: false,
          },
        ],
      },
      residentProfile: {
        create: {
          tenantId: org.id,
          status: ResidentStatus.PROSPECT,
          preferredPropertyId: property?.id ?? null,
          notes: 'Sprint-07 demo prospect — safe for staging.',
          retentionClass: 'STANDARD',
        },
      },
      identifiers: {
        create: {
          tenantId: org.id,
          identifierType: 'GOVERNMENT_ID',
          issuer: 'US-DEMO',
          valueEncrypted: Buffer.from('DEMO-ID-0007').toString('base64'),
          lookupHash: lookupHash('DEMO-ID-0007'),
          keyVersion: 'local-v1',
          verificationStatus: 'UNVERIFIED',
        },
      },
    },
    include: { residentProfile: true },
  });

  if (property !== null) {
    await prisma.waitlistEntry.create({
      data: {
        tenantId: org.id,
        partyId: party.id,
        propertyId: property.id,
        status: WaitlistEntryStatus.OPEN,
        priority: 50,
        criteria: { beds: 1, pets: false },
        notes: 'Demo waitlist entry',
        consentAt: new Date(),
      },
    });
  }

  const objectKey = `org/${org.id}/documents/demo/${randomUUID()}.txt`;
  const document = await prisma.document.create({
    data: {
      tenantId: org.id,
      title: 'Demo ID Scan Placeholder',
      category: 'IDENTITY',
      visibility: DocumentVisibility.STAFF,
      retentionClass: 'STANDARD',
      status: DocumentStatus.READY,
      createdByUserId: actor.id,
      versions: {
        create: {
          tenantId: org.id,
          versionNumber: 1,
          objectKey,
          fileName: 'demo-id.txt',
          mimeType: 'text/plain',
          sizeBytes: 12,
          checksumSha256: lookupHash('demo-content'),
          scanStatus: DocumentStatus.READY,
        },
      },
      links: {
        create: {
          tenantId: org.id,
          linkType: 'RESIDENT',
          partyId: party.id,
        },
      },
    },
    include: { versions: true },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { currentVersionId: document.versions[0]?.id },
  });

  // Ensure membership exists (no-op if already)
  await prisma.tenantMembership.findFirst({
    where: { tenantId: org.id, userId: actor.id, status: MembershipStatus.ACTIVE },
  });

  console.log(
    JSON.stringify(
      {
        organizationId: org.id,
        partyId: party.id,
        residentId: party.residentProfile?.id,
        documentId: document.id,
        note: 'Object bytes may be absent in local storage; re-upload via UI for download demos.',
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
