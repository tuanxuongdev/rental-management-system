import { createHash, randomUUID } from 'node:crypto';

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PERMISSION_KEYS } from '@rpm/contracts';
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
import { ResidentService } from '../residents/application/resident.service';
import { AuthorizationService } from '../tenancy/application/authorization.service';
import { OrganizationService } from '../tenancy/application/organization.service';
import { RbacSeedService } from '../tenancy/application/rbac-seed.service';

import { DocumentService } from './application/document.service';
import { assertDocumentUploadAllowed, clampDownloadTtlSeconds } from './domain/document.rules';

const databaseAvailable = await isDatabaseReachable();

describe.skipIf(!databaseAvailable)('Documents isolation (Sprint-07)', () => {
  const prisma = createIntegrationPrismaClient();
  const transactions = new TransactionService(prisma as never);
  const passwords = new PasswordHasherService();
  const audit = new AuditService(prisma as never);
  const rbacSeed = new RbacSeedService(prisma as never);
  const authorization = new AuthorizationService(prisma as never);
  const organizations = new OrganizationService(prisma as never, transactions, audit, rbacSeed);
  const residents = new ResidentService(prisma as never, transactions, authorization, audit);
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

  it('T07-07: upload → scanning → ready status transitions', async () => {
    const { user, org, membership } = await createOwnerOrg('docs-t0707@example.com', 'Docs Org');
    const resident = await residents.createResident(org.id, membership.id, user.id, {
      displayName: 'Doc Owner',
    });
    const bytes = Buffer.from('%PDF-1.4 sample');
    const checksum = createHash('sha256').update(bytes).digest('hex');

    const intent = await documents.createUploadIntent(org.id, membership.id, user.id, {
      title: 'ID',
      category: 'IDENTITY',
      fileName: 'id.pdf',
      mimeType: 'application/pdf',
      sizeBytes: bytes.byteLength,
      checksumSha256: checksum,
      contentBase64: bytes.toString('base64'),
      partyId: resident.id,
      linkType: 'RESIDENT',
    });
    expect(intent.document.status).toBe('UPLOADING');

    const completed = await documents.completeUpload(
      org.id,
      membership.id,
      user.id,
      intent.document.id,
      {
        versionId: intent.versionId,
        checksumSha256: checksum,
        sizeBytes: bytes.byteLength,
      },
    );
    expect(completed.status).toBe('READY');
    expect(completed.currentVersion?.scanStatus).toBe('READY');

    const download = await documents.createDownloadUrl(
      org.id,
      membership.id,
      user.id,
      intent.document.id,
      {},
    );
    expect(download.mode).toBe('authenticated');
    expect(download.url).toContain('/content');
  });

  it('T07-08: download URL TTL is clamped', () => {
    expect(clampDownloadTtlSeconds(undefined)).toBe(300);
    expect(clampDownloadTtlSeconds(1)).toBe(1);
    expect(clampDownloadTtlSeconds(12_000)).toBe(900);
  });

  it('T07-09: download without permission is denied', async () => {
    const { user, org, membership } = await createOwnerOrg('docs-t0709@example.com', 'Docs Deny');
    const bytes = Buffer.from('ready');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const intent = await documents.createUploadIntent(org.id, membership.id, user.id, {
      title: 'Denied',
      category: 'OTHER',
      fileName: 'a.txt',
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

    const limitedUser = await provisionVerifiedUser(
      `noperm-${randomUUID()}@example.com`,
      'ValidPassword123!',
    );
    const limitedMembership = await prisma.tenantMembership.create({
      data: {
        tenantId: org.id,
        userId: limitedUser.id,
        membershipType: 'WORKFORCE',
        status: MembershipStatus.ACTIVE,
      },
    });

    await expect(
      authorization.assertPermission(limitedMembership.id, org.id, PERMISSION_KEYS.DOCUMENTS_VIEW),
    ).rejects.toBeInstanceOf(ForbiddenException);

    // Cross-org document id also non-disclosing
    const other = await createOwnerOrg('docs-t0709b@example.com', 'Other Org');
    await expect(
      documents.getDocument(other.org.id, other.membership.id, intent.document.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('T07-12: object key without org prefix is rejected', async () => {
    const { org } = await createOwnerOrg('docs-t0712@example.com', 'Key Org');
    expect(() =>
      documents.assertObjectKeyForOrganization(org.id, 'not-org-prefixed/file.pdf'),
    ).toThrow(/OBJECT_KEY_TENANT_MISMATCH/);
    expect(() =>
      documents.assertObjectKeyForOrganization(org.id, `org/${org.id}/../escape`),
    ).toThrow();
  });

  it('rejects executable uploads', () => {
    expect(() =>
      assertDocumentUploadAllowed({
        mimeType: 'application/x-msdownload',
        sizeBytes: 100,
        fileName: 'malware.exe',
      }),
    ).toThrow(/FILE_TYPE_NOT_ALLOWED/);
  });

  it('rejects download when document is not READY', async () => {
    const { user, org, membership } = await createOwnerOrg('docs-notready@example.com', 'NR');
    const bytes = Buffer.from('pending');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const intent = await documents.createUploadIntent(org.id, membership.id, user.id, {
      title: 'Pending',
      category: 'OTHER',
      fileName: 'p.txt',
      mimeType: 'text/plain',
      sizeBytes: bytes.byteLength,
      checksumSha256: checksum,
      contentBase64: bytes.toString('base64'),
    });
    await expect(
      documents.createDownloadUrl(org.id, membership.id, user.id, intent.document.id, {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
