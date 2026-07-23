import { createHash, randomUUID } from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  PreconditionFailedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { SYSTEM_ROLE_KEYS } from '@rpm/contracts';
import {
  createIntegrationPrismaClient,
  isDatabaseReachable,
  resetPlatformTables,
} from '@rpm/testing';

import { loadApiConfig } from '../../bootstrap/configuration';
import { PasswordHasherService } from '../../infrastructure/crypto/crypto.services';
import { TransactionService } from '../../infrastructure/persistence/transaction.service';
import { S3StorageClient } from '../../infrastructure/storage/s3-storage.client';
import { AuditService } from '../audit/audit.service';
import { DocumentService } from '../documents/application/document.service';
import { PropertyService } from '../inventory/application/property.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { ResidentService } from './application/resident.service';
import { WaitlistService } from './application/waitlist.service';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Residents + documents isolation (Sprint-07)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const properties = new PropertyService(prisma as never, transactions, authorization, audit);
  const residents = new ResidentService(prisma as never, transactions, authorization, audit);
  const waitlist = new WaitlistService(prisma as never, authorization, audit);
  const storage = new S3StorageClient(loadApiConfig() as never);
  const documents = new DocumentService(
    prisma as never,
    transactions,
    storage,
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

  async function assignAuditor(orgId: string) {
    const role = await prisma.role.findFirstOrThrow({
      where: { tenantId: null, key: SYSTEM_ROLE_KEYS.AUDITOR },
    });
    const user = await provisionVerifiedUser(
      `auditor-${randomUUID()}@example.com`,
      'ValidPassword123!',
    );
    const membership = await prisma.tenantMembership.create({
      data: {
        tenantId: orgId,
        userId: user.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });
    await prisma.membershipRole.create({
      data: {
        id: randomUUID(),
        tenantId: orgId,
        membershipId: membership.id,
        roleId: role.id,
      },
    });
    return { user, membership };
  }

  it('T07-01: create resident happy path (persisted + audited)', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0701@example.com', 'Org T0701');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'P-R1',
      name: 'Resident House',
      propertyType: 'BOARDING_HOUSE',
      addressLine1: '1 Main St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    const created = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Alex Resident',
      preferredPropertyId: property.id,
      dateOfBirth: '1990-05-15',
      contacts: [{ type: 'email', value: 'Alex@Example.com' }],
      notes: 'VIP prospect',
    });

    expect(created.displayName).toBe('Alex Resident');
    expect(created.partyId).toBe(created.id);
    expect(created.preferredPropertyId).toBe(property.id);

    const profile = await prisma.residentProfile.findFirst({
      where: { partyId: created.id, tenantId: org.id },
    });
    expect(profile).not.toBeNull();

    const events = await prisma.auditEvent.findMany({
      where: { tenantId: org.id, action: 'resident.create', targetId: created.id },
    });
    expect(events).toHaveLength(1);
  });

  it('T07-02: duplicate-check match returns candidates without auto-merge', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0702@example.com', 'Org T0702');
    await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Sam One',
      contacts: [
        { type: 'email', value: 'sam@example.com' },
        { type: 'phone', value: '+1 (555) 111-2222' },
      ],
      confirmDuplicateProceed: true,
    });

    const result = await residents.duplicateCheck(org.id, membership.id, {
      email: 'SAM@example.com',
      phone: '555-111-2222',
    });
    expect(result.autoMerge).toBe(false);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    expect(result.candidates[0]?.matchReasons).toEqual(expect.arrayContaining(['email', 'phone']));

    await expect(
      residents.createResident(org.id, membership.id, user.id, {
        displayName: 'Sam Two',
        contacts: [{ type: 'email', value: 'sam@example.com' }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('T07-03: Property Manager out of scope gets 404/empty', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0703@example.com', 'Org T0703');
    const propertyA = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'PA',
      name: 'Property A',
      propertyType: 'APARTMENT',
      addressLine1: '1 A St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const propertyB = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'PB',
      name: 'Property B',
      propertyType: 'APARTMENT',
      addressLine1: '1 B St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });

    const residentA = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Scoped A',
      preferredPropertyId: propertyA.id,
    });
    await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Scoped B',
      preferredPropertyId: propertyB.id,
    });
    await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'No Preferred',
    });

    const { membership: pmMembership, pmUser } = await assignPropertyManager(org.id, [
      propertyA.id,
    ]);

    const listed = await residents.listResidents(org.id, pmMembership.id, {});
    expect(listed.data.map((item) => item.id)).toEqual([residentA.id]);

    await expect(
      residents.getResident(org.id, pmMembership.id, residentA.id),
    ).resolves.toMatchObject({ id: residentA.id });

    const residentB = await prisma.residentProfile.findFirstOrThrow({
      where: { tenantId: org.id, preferredPropertyId: propertyB.id },
    });
    await expect(
      residents.getResident(org.id, pmMembership.id, residentB.partyId),
    ).rejects.toBeInstanceOf(NotFoundException);

    await expect(
      residents.createResident(org.id, pmMembership.id, pmUser.id, {
        displayName: 'Missing Preferred',
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('T07-04: cross-org resident id returns 404', async () => {
    const a = await createOwnerOrg('owner-t0704a@example.com', 'Org T0704A');
    const b = await createOwnerOrg('owner-t0704b@example.com', 'Org T0704B');
    const resident = await residents.createResident(a.org.id, a.membership.id, a.user.id, {
      displayName: 'Org A Resident',
    });

    await expect(
      residents.getResident(b.org.id, b.membership.id, resident.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T07-05: user without PII reveal sees masked fields', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0705@example.com', 'Org T0705');
    const created = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'PII Person',
      dateOfBirth: '1988-03-09',
      notes: 'Sensitive note',
      contacts: [{ type: 'email', value: 'secret@example.com', isPreferred: true }],
    });

    const { membership: auditorMembership } = await assignAuditor(org.id);
    const flags = await residents.resolveSensitiveFlags(auditorMembership.id, org.id);
    expect(flags.includeSensitive).toBe(false);
    expect(flags.canViewNotes).toBe(false);

    const viewed = await residents.getResident(org.id, auditorMembership.id, created.id, flags);
    expect(viewed.dateOfBirth).toBeUndefined();
    expect(viewed.dateOfBirthMasked).toBe('****-**-09');
    expect(viewed.notes).toBeUndefined();
    expect(viewed.contacts[0]?.value).not.toBe('secret@example.com');
    expect(viewed.contacts[0]?.value).toMatch(/\*+\.com$/);
  });

  it('T07-06: set/clear do-not-rent is audited and permission enforced', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0706@example.com', 'Org T0706');
    const property = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'PDNR',
      name: 'DNR House',
      propertyType: 'APARTMENT',
      addressLine1: '9 Flag St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const resident = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Flagged',
      preferredPropertyId: property.id,
    });

    const set = await residents.setDoNotRent(org.id, membership.id, user.id, resident.id, {
      reason: 'Prior eviction',
      category: 'EVICTION',
    });
    expect(set.activeDoNotRent?.status).toBe('ACTIVE');

    const setEvents = await prisma.auditEvent.findMany({
      where: { tenantId: org.id, action: 'resident.do_not_rent.set', targetId: resident.id },
    });
    expect(setEvents).toHaveLength(1);

    const cleared = await residents.clearDoNotRent(org.id, membership.id, user.id, resident.id, {
      reason: 'Reviewed and cleared',
    });
    expect(cleared.activeDoNotRent).toBeNull();

    const { membership: pmMembership, pmUser } = await assignPropertyManager(org.id, [property.id]);
    await expect(
      residents.setDoNotRent(org.id, pmMembership.id, pmUser.id, resident.id, {
        reason: 'PM should not manage',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('T07-10: waitlist create for unauthorized property is denied', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t0710@example.com', 'Org T0710');
    const propertyA = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'WA',
      name: 'Wait A',
      propertyType: 'APARTMENT',
      addressLine1: '1 Wait St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const propertyB = await properties.createProperty(org.id, user.id, membership.id, {
      code: 'WB',
      name: 'Wait B',
      propertyType: 'APARTMENT',
      addressLine1: '2 Wait St',
      city: 'Austin',
      timeZone: 'UTC',
      defaultCurrency: 'USD',
    });
    const resident = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Waitlisted',
      preferredPropertyId: propertyA.id,
    });
    const { membership: pmMembership, pmUser } = await assignPropertyManager(org.id, [
      propertyA.id,
    ]);

    await expect(
      waitlist.createEntry(org.id, pmMembership.id, pmUser.id, {
        partyId: resident.id,
        propertyId: propertyB.id,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const created = await waitlist.createEntry(org.id, pmMembership.id, pmUser.id, {
      partyId: resident.id,
      propertyId: propertyA.id,
    });
    expect(created.propertyId).toBe(propertyA.id);
  });

  it('T07-11: isolation suite residents/documents cross-org denial', async () => {
    const a = await createOwnerOrg('owner-t0711a@example.com', 'Org T0711A');
    const b = await createOwnerOrg('owner-t0711b@example.com', 'Org T0711B');
    const resident = await residents.createResident(a.org.id, a.membership.id, a.user.id, {
      displayName: 'Isolation Resident',
    });
    const pdf = Buffer.from('%PDF-1.4 isolation');
    const checksum = createHash('sha256').update(pdf).digest('hex');
    const intent = await documents.createUploadIntent(a.org.id, a.membership.id, a.user.id, {
      title: 'Isolation Doc',
      category: 'OTHER',
      fileName: 'iso.pdf',
      mimeType: 'application/pdf',
      sizeBytes: pdf.byteLength,
      checksumSha256: checksum,
      contentBase64: pdf.toString('base64'),
      partyId: resident.id,
      linkType: 'RESIDENT',
    });
    await documents.completeUpload(a.org.id, a.membership.id, a.user.id, intent.document.id, {
      versionId: intent.versionId,
      checksumSha256: checksum,
      sizeBytes: pdf.byteLength,
    });

    await expect(
      residents.getResident(b.org.id, b.membership.id, resident.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      documents.getDocument(b.org.id, b.membership.id, intent.document.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects If-Match version mismatch on resident patch', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t07vm@example.com', 'Org T07VM');
    const resident = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Versioned',
    });
    await expect(
      residents.patchResident(
        org.id,
        membership.id,
        user.id,
        resident.id,
        { displayName: 'X' },
        999,
      ),
    ).rejects.toBeInstanceOf(PreconditionFailedException);
  });

  it('links READY document to resident party', async () => {
    const { user, org, membership } = await createOwnerOrg('owner-t07link@example.com', 'Org Link');
    const resident = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Link Me',
    });
    const bytes = Buffer.from('link-doc');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const intent = await documents.createUploadIntent(org.id, membership.id, user.id, {
      title: 'Unlinked',
      category: 'OTHER',
      fileName: 'note.txt',
      mimeType: 'text/plain',
      sizeBytes: bytes.byteLength,
      checksumSha256: checksum,
      contentBase64: bytes.toString('base64'),
    });
    await documents.completeUpload(org.id, membership.id, user.id, intent.document.id, {
      versionId: intent.versionId,
      checksumSha256: checksum,
      sizeBytes: bytes.byteLength,
    });
    const link = await documents.createLink(org.id, membership.id, user.id, intent.document.id, {
      linkType: 'RESIDENT',
      partyId: resident.id,
    });
    expect(link.partyId).toBe(resident.id);

    await expect(
      documents.createLink(org.id, membership.id, user.id, intent.document.id, {
        linkType: 'RESIDENT',
        partyId: resident.id,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
