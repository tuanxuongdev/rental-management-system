import { createHash, randomUUID } from 'node:crypto';

import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  type Document,
  type DocumentLink,
  type DocumentStatus,
  type DocumentVersion,
  type DocumentVisibility,
  type Prisma,
} from '@prisma/client';

import {
  type CompleteUploadRequest,
  type CreateDocumentLinkRequest,
  DOCUMENT_DOWNLOAD_TTL_DEFAULT_SECONDS,
  type DocumentLinkResponse,
  type DocumentResponse,
  type DocumentsCollection,
  type DocumentVersionResponse,
  type DownloadUrlRequest,
  type DownloadUrlResponse,
  normalizePaginationLimit,
  PAGINATION_DEFAULT_LIMIT,
  PERMISSION_KEYS,
  type UploadIntentRequest,
  type UploadIntentResponse,
} from '@rpm/contracts';

import { TransactionService } from '../../../infrastructure/persistence/transaction.service';
import { PrismaService } from '../../../infrastructure/prisma/prisma.module';
import { S3StorageClient } from '../../../infrastructure/storage/s3-storage.client';
import { AuditService } from '../../audit/audit.service';
import { AuthorizationService } from '../../tenancy/application/authorization.service';
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  assertDocumentUploadAllowed,
  clampDownloadTtlSeconds,
  relativePathFromObjectKey,
  stubScanResult,
} from '../domain/document.rules';

type DocumentWithRelations = Document & {
  versions?: DocumentVersion[];
  links?: DocumentLink[];
};

@Injectable()
export class DocumentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionService) private readonly transactions: TransactionService,
    @Inject(S3StorageClient) private readonly storage: S3StorageClient,
    @Inject(AuthorizationService) private readonly authorization: AuthorizationService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async listDocuments(
    organizationId: string,
    membershipId: string,
    options?: {
      limit?: number;
      after?: string;
      status?: string;
      category?: string;
      partyId?: string;
      propertyId?: string;
      q?: string;
    },
  ): Promise<DocumentsCollection> {
    const limit = normalizePaginationLimit(options?.limit ?? PAGINATION_DEFAULT_LIMIT);
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );

    if (options?.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(
        membershipId,
        organizationId,
        options.propertyId,
      );
    }

    const linkScope = await this.buildDocumentLinkScope(
      organizationId,
      accessible,
      options?.partyId,
      options?.propertyId,
    );

    const documents = await this.prisma.document.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        ...linkScope,
        ...(options?.status !== undefined ? { status: options.status as DocumentStatus } : {}),
        ...(options?.category !== undefined ? { category: options.category } : {}),
        ...(options?.q !== undefined
          ? { title: { contains: options.q, mode: 'insensitive' } }
          : {}),
        ...(options?.after !== undefined ? { id: { gt: options.after } } : {}),
      },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        links: true,
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });

    const pageItems = documents.slice(0, limit);
    const hasMore = documents.length > limit;
    const last = pageItems.at(-1);

    return {
      data: pageItems.map((item) => this.toResponse(item, true)),
      page: {
        nextCursor: hasMore && last !== undefined ? last.id : null,
        previousCursor: null,
        limit,
      },
      meta: {},
    };
  }

  async getDocument(
    organizationId: string,
    membershipId: string,
    documentId: string,
  ): Promise<DocumentResponse> {
    const document = await this.findDocument(organizationId, documentId);
    await this.assertDocumentAccessible(organizationId, membershipId, document);
    return this.toResponse(document, true);
  }

  async createUploadIntent(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    body: UploadIntentRequest,
    correlationId?: string,
  ): Promise<UploadIntentResponse> {
    void membershipId;
    try {
      assertDocumentUploadAllowed({
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        fileName: body.fileName,
      });
    } catch (error) {
      this.throwUploadValidation(error);
    }

    if (body.partyId !== undefined) {
      const party = await this.prisma.party.findFirst({
        where: {
          id: body.partyId,
          tenantId: organizationId,
          deletedAt: null,
          residentProfile: { isNot: null },
        },
      });
      if (party === null) {
        throw new NotFoundException({
          message: 'Resident not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }
    if (body.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }
    if (body.leaseId !== undefined) {
      await this.authorization.assertPermission(
        membershipId,
        organizationId,
        PERMISSION_KEYS.LEASES_UPDATE,
      );
      const lease = await this.prisma.lease.findFirst({
        where: { id: body.leaseId, tenantId: organizationId, deletedAt: null },
      });
      if (lease === null) {
        throw new NotFoundException({
          message: 'Lease not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      await this.authorization.assertPropertyAccess(membershipId, organizationId, lease.propertyId);
    }

    const documentId = randomUUID();
    const versionId = randomUUID();
    const relativePath = `documents/${documentId}/v1/${body.fileName}`;
    const objectKey = this.storage.buildObjectKey(organizationId, relativePath);
    this.storage.assertOrganizationObjectKey(organizationId, objectKey);

    if (body.contentBase64 !== undefined) {
      const bytes = Buffer.from(body.contentBase64, 'base64');
      if (bytes.byteLength !== body.sizeBytes) {
        throw new UnprocessableEntityException({
          message: 'contentBase64 size does not match sizeBytes',
          code: 'CHECKSUM_INVALID',
        });
      }
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum.toLowerCase() !== body.checksumSha256.toLowerCase()) {
        throw new UnprocessableEntityException({
          message: 'Checksum mismatch',
          code: 'CHECKSUM_INVALID',
        });
      }
      await this.storage.putObject({
        organizationId,
        relativePath,
        body: new Uint8Array(bytes),
        contentType: body.mimeType,
      });
    }

    const created = await this.transactions.run(async (tx) => {
      const document = await tx.document.create({
        data: {
          id: documentId,
          tenantId: organizationId,
          title: body.title,
          category: body.category,
          visibility: (body.visibility as DocumentVisibility | undefined) ?? 'STAFF',
          retentionClass: body.retentionClass ?? 'STANDARD',
          status: 'UPLOADING',
          createdByUserId: actorUserId,
          currentVersionId: versionId,
          versions: {
            create: {
              id: versionId,
              tenantId: organizationId,
              versionNumber: 1,
              objectKey,
              fileName: body.fileName,
              mimeType: body.mimeType,
              sizeBytes: body.sizeBytes,
              checksumSha256: body.checksumSha256.toLowerCase(),
              scanStatus: 'UPLOADING',
            },
          },
          ...(body.partyId !== undefined ||
          body.propertyId !== undefined ||
          body.leaseId !== undefined
            ? {
                links: {
                  create: {
                    tenantId: organizationId,
                    linkType: body.linkType ?? 'ATTACHMENT',
                    partyId: body.partyId ?? null,
                    propertyId: body.propertyId ?? null,
                    leaseId: body.leaseId ?? null,
                  },
                },
              }
            : {}),
        },
        include: {
          versions: true,
          links: true,
        },
      });
      return document;
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'document.upload_intent',
      outcome: 'SUCCESS',
      targetType: 'document',
      targetId: documentId,
      correlationId,
      changeSummary: { title: body.title, category: body.category },
    });

    const expiresAt = new Date(Date.now() + DOCUMENT_DOWNLOAD_TTL_DEFAULT_SECONDS * 1000);

    return {
      document: this.toResponse(created, true),
      versionId,
      objectKey,
      uploadUrl:
        body.contentBase64 !== undefined
          ? null
          : `/v1/organizations/${organizationId}/object-storage/${encodeURIComponent(relativePath)}`,
      expiresAt: expiresAt.toISOString(),
      maxSizeBytes: body.sizeBytes,
      allowedMimeTypes: [...ALLOWED_DOCUMENT_MIME_TYPES],
    };
  }

  async completeUpload(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    documentId: string,
    body: CompleteUploadRequest,
    correlationId?: string,
  ): Promise<DocumentResponse> {
    void membershipId;
    const document = await this.findDocument(organizationId, documentId);
    const version = document.versions?.find((item) => item.id === body.versionId);
    if (version === undefined) {
      throw new NotFoundException({
        message: 'Document version not found',
        code: 'UPLOAD_NOT_FOUND',
      });
    }
    if (document.status !== 'UPLOADING' && document.status !== 'SCANNING') {
      throw new ConflictException({
        message: 'Upload already completed',
        code: 'UPLOAD_ALREADY_COMPLETED',
      });
    }

    try {
      assertDocumentUploadAllowed({
        mimeType: version.mimeType,
        sizeBytes: body.sizeBytes,
        fileName: version.fileName,
      });
    } catch (error) {
      this.throwUploadValidation(error);
    }

    if (body.checksumSha256.toLowerCase() !== version.checksumSha256.toLowerCase()) {
      throw new UnprocessableEntityException({
        message: 'Checksum mismatch',
        code: 'CHECKSUM_INVALID',
      });
    }
    if (body.sizeBytes !== version.sizeBytes) {
      throw new UnprocessableEntityException({
        message: 'Size mismatch',
        code: 'CHECKSUM_INVALID',
      });
    }

    this.storage.assertOrganizationObjectKey(organizationId, version.objectKey);
    const relativePath = relativePathFromObjectKey(organizationId, version.objectKey);

    if (body.contentBase64 !== undefined) {
      const bytes = Buffer.from(body.contentBase64, 'base64');
      const checksum = createHash('sha256').update(bytes).digest('hex');
      if (checksum.toLowerCase() !== body.checksumSha256.toLowerCase()) {
        throw new UnprocessableEntityException({
          message: 'Checksum mismatch',
          code: 'CHECKSUM_INVALID',
        });
      }
      await this.storage.putObject({
        organizationId,
        relativePath,
        body: new Uint8Array(bytes),
        contentType: version.mimeType,
      });
    }

    const existingObject = await this.storage.getObject(version.objectKey);
    if (existingObject === null) {
      throw new ConflictException({
        message: 'Uploaded object not found',
        code: 'UPLOAD_NOT_FOUND',
      });
    }

    const storedChecksum = createHash('sha256').update(existingObject.body).digest('hex');
    if (storedChecksum.toLowerCase() !== body.checksumSha256.toLowerCase()) {
      throw new UnprocessableEntityException({
        message: 'Stored object checksum mismatch',
        code: 'CHECKSUM_INVALID',
      });
    }
    if (existingObject.body.byteLength !== body.sizeBytes) {
      throw new UnprocessableEntityException({
        message: 'Stored object size mismatch',
        code: 'CHECKSUM_INVALID',
      });
    }

    const scan = stubScanResult(version.mimeType);

    const updated = await this.transactions.run(async (tx) => {
      await tx.document.update({
        where: { id: documentId },
        data: { status: 'SCANNING', version: { increment: 1 } },
      });
      await tx.documentVersion.update({
        where: { id: version.id },
        data: {
          scanStatus: scan.status,
          scanDetail: scan.detail,
        },
      });
      return tx.document.update({
        where: { id: documentId },
        data: {
          status: scan.status,
          version: { increment: 1 },
        },
        include: { versions: true, links: true },
      });
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'document.complete_upload',
      outcome: 'SUCCESS',
      targetType: 'document',
      targetId: documentId,
      correlationId,
      changeSummary: { status: scan.status },
    });

    return this.toResponse(updated, true);
  }

  async createDownloadUrl(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    documentId: string,
    body: DownloadUrlRequest,
    correlationId?: string,
  ): Promise<DownloadUrlResponse> {
    const document = await this.findDocument(organizationId, documentId);
    await this.assertDocumentAccessible(organizationId, membershipId, document);
    if (document.status !== 'READY') {
      throw new ConflictException({
        message: 'Document is not ready for download',
        code: 'DOCUMENT_NOT_READY',
      });
    }

    const versionId = body.versionId ?? document.currentVersionId;
    const version = document.versions?.find((item) => item.id === versionId);
    if (version === undefined || version.scanStatus !== 'READY') {
      throw new ConflictException({
        message: 'Document version is not ready',
        code: 'DOCUMENT_NOT_READY',
      });
    }

    this.storage.assertOrganizationObjectKey(organizationId, version.objectKey);
    const expiresInSeconds = clampDownloadTtlSeconds(body.expiresInSeconds);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // Local / unconfigured S3: use authenticated content endpoint (authz rechecked on GET).
    // Configured S3: short-lived signed URL.
    const useAuthenticatedContent = !this.storage.isConfigured();
    let url: string;
    let mode: 's3' | 'authenticated';
    if (useAuthenticatedContent) {
      url = `/v1/organizations/${organizationId}/documents/${documentId}/content`;
      mode = 'authenticated';
    } else {
      const relativePath = relativePathFromObjectKey(organizationId, version.objectKey);
      const signed = await this.storage.getSignedOrLocalUrl(
        organizationId,
        relativePath,
        expiresInSeconds,
      );
      url = signed.url;
      mode = 's3';
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'document.download_url',
      outcome: 'SUCCESS',
      targetType: 'document',
      targetId: documentId,
      correlationId,
      changeSummary: {
        expiresInSeconds,
        disposition: body.disposition ?? 'ATTACHMENT',
        mode,
      },
    });

    return {
      url,
      mode,
      expiresAt: expiresAt.toISOString(),
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      checksumSha256: version.checksumSha256,
      expiresInSeconds,
    };
  }

  /**
   * Authenticated byte download (local storage / authz recheck). Prefer over capability URLs locally.
   */
  async getDocumentContent(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    documentId: string,
    correlationId?: string,
  ): Promise<{ body: Uint8Array; mimeType: string; fileName: string; sizeBytes: number }> {
    const document = await this.findDocument(organizationId, documentId);
    await this.assertDocumentAccessible(organizationId, membershipId, document);
    if (document.status !== 'READY') {
      throw new ConflictException({
        message: 'Document is not ready for download',
        code: 'DOCUMENT_NOT_READY',
      });
    }
    const version =
      document.versions?.find((item) => item.id === document.currentVersionId) ??
      document.versions?.[0];
    if (version === undefined || version.scanStatus !== 'READY') {
      throw new ConflictException({
        message: 'Document version is not ready',
        code: 'DOCUMENT_NOT_READY',
      });
    }

    this.storage.assertOrganizationObjectKey(organizationId, version.objectKey);
    const object = await this.storage.getObject(version.objectKey);
    if (object === null) {
      throw new NotFoundException({
        message: 'Document object not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'document.download_content',
      outcome: 'SUCCESS',
      targetType: 'document',
      targetId: documentId,
      correlationId,
      changeSummary: { sizeBytes: version.sizeBytes },
    });

    return {
      body: object.body,
      mimeType: version.mimeType,
      fileName: version.fileName,
      sizeBytes: version.sizeBytes,
    };
  }

  async createLink(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    documentId: string,
    body: CreateDocumentLinkRequest,
    correlationId?: string,
  ): Promise<DocumentLinkResponse> {
    const document = await this.findDocument(organizationId, documentId);
    if (document.status !== 'READY') {
      throw new ConflictException({
        message: 'Document is not ready',
        code: 'DOCUMENT_NOT_READY',
      });
    }

    if (body.partyId !== undefined) {
      const party = await this.prisma.party.findFirst({
        where: {
          id: body.partyId,
          tenantId: organizationId,
          deletedAt: null,
          residentProfile: { isNot: null },
        },
      });
      if (party === null) {
        throw new NotFoundException({
          message: 'Resident not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
    }
    if (body.propertyId !== undefined) {
      await this.authorization.assertPropertyAccess(membershipId, organizationId, body.propertyId);
    }
    if (body.leaseId !== undefined) {
      await this.authorization.assertPermission(
        membershipId,
        organizationId,
        PERMISSION_KEYS.LEASES_UPDATE,
      );
      const lease = await this.prisma.lease.findFirst({
        where: {
          id: body.leaseId,
          tenantId: organizationId,
          deletedAt: null,
        },
      });
      if (lease === null) {
        throw new NotFoundException({
          message: 'Lease not found',
          code: 'RESOURCE_NOT_FOUND',
        });
      }
      await this.authorization.assertPropertyAccess(membershipId, organizationId, lease.propertyId);
    }

    try {
      const existing = await this.prisma.documentLink.findFirst({
        where: {
          tenantId: organizationId,
          documentId,
          linkType: body.linkType,
          partyId: body.partyId ?? null,
          propertyId: body.propertyId ?? null,
          leaseId: body.leaseId ?? null,
        },
      });
      if (existing !== null) {
        throw new ConflictException({
          message: 'Document already linked',
          code: 'DOCUMENT_ALREADY_LINKED',
        });
      }

      const link = await this.prisma.documentLink.create({
        data: {
          tenantId: organizationId,
          documentId,
          linkType: body.linkType,
          partyId: body.partyId ?? null,
          propertyId: body.propertyId ?? null,
          leaseId: body.leaseId ?? null,
        },
      });

      await this.audit.record({
        tenantId: organizationId,
        actorUserId,
        action: 'document.link.create',
        outcome: 'SUCCESS',
        targetType: 'document_link',
        targetId: link.id,
        correlationId,
        changeSummary: {
          documentId,
          linkType: body.linkType,
          partyId: body.partyId ?? null,
          leaseId: body.leaseId ?? null,
        },
      });

      return this.toLinkResponse(link);
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) {
        throw error;
      }
      throw new ConflictException({
        message: 'Document already linked',
        code: 'DOCUMENT_ALREADY_LINKED',
      });
    }
  }

  async deleteDocument(
    organizationId: string,
    membershipId: string,
    actorUserId: string,
    documentId: string,
    correlationId?: string,
  ): Promise<void> {
    void membershipId;
    const document = await this.findDocument(organizationId, documentId);
    if (document.legalHold) {
      throw new ConflictException({
        message: 'Document is under legal hold',
        code: 'LEGAL_HOLD_ACTIVE',
      });
    }

    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.audit.record({
      tenantId: organizationId,
      actorUserId,
      action: 'document.delete',
      outcome: 'SUCCESS',
      targetType: 'document',
      targetId: documentId,
      correlationId,
    });
  }

  /** Used by T07-12 to verify org key helper rejects cross-org keys. */
  assertObjectKeyForOrganization(organizationId: string, objectKey: string): void {
    this.storage.assertOrganizationObjectKey(organizationId, objectKey);
  }

  private async buildDocumentLinkScope(
    organizationId: string,
    accessible: string[] | null,
    partyId?: string,
    propertyId?: string,
  ): Promise<Prisma.DocumentWhereInput> {
    if (accessible === null) {
      if (partyId !== undefined && propertyId !== undefined) {
        return {
          AND: [{ links: { some: { partyId } } }, { links: { some: { propertyId } } }],
        };
      }
      if (partyId !== undefined) {
        return { links: { some: { partyId } } };
      }
      if (propertyId !== undefined) {
        return { links: { some: { propertyId } } };
      }
      return {};
    }

    const propertyIds = propertyId !== undefined ? [propertyId] : accessible;
    const scopedResidents = await this.prisma.residentProfile.findMany({
      where: {
        tenantId: organizationId,
        deletedAt: null,
        preferredPropertyId: { in: propertyIds },
      },
      select: { partyId: true },
    });
    const scopedPartyIds = scopedResidents.map((row) => row.partyId);
    const partyFilter =
      partyId !== undefined ? (scopedPartyIds.includes(partyId) ? [partyId] : []) : scopedPartyIds;

    return {
      OR: [
        { links: { some: { propertyId: { in: propertyIds } } } },
        ...(partyFilter.length > 0 ? [{ links: { some: { partyId: { in: partyFilter } } } }] : []),
        {
          links: {
            some: {
              leaseId: { not: null },
              lease: { propertyId: { in: propertyIds }, deletedAt: null },
            },
          },
        },
      ],
    };
  }

  private async assertDocumentAccessible(
    organizationId: string,
    membershipId: string,
    document: DocumentWithRelations,
  ): Promise<void> {
    const accessible = await this.authorization.resolveAccessiblePropertyIds(
      membershipId,
      organizationId,
    );
    if (accessible === null) {
      return;
    }

    const links = document.links ?? [];
    const propertyHit = links.some(
      (link) => link.propertyId !== null && accessible.includes(link.propertyId),
    );
    if (propertyHit) {
      return;
    }

    const leaseIds = links.map((link) => link.leaseId).filter((id): id is string => id !== null);
    if (leaseIds.length > 0) {
      const leaseHit = await this.prisma.lease.count({
        where: {
          tenantId: organizationId,
          id: { in: leaseIds },
          propertyId: { in: accessible },
          deletedAt: null,
        },
      });
      if (leaseHit > 0) {
        return;
      }
    }

    const partyIds = links.map((link) => link.partyId).filter((id): id is string => id !== null);
    if (partyIds.length === 0) {
      throw new NotFoundException({
        message: 'Document not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }

    const allowed = await this.prisma.residentProfile.count({
      where: {
        tenantId: organizationId,
        partyId: { in: partyIds },
        preferredPropertyId: { in: accessible },
        deletedAt: null,
      },
    });
    if (allowed === 0) {
      throw new NotFoundException({
        message: 'Document not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
  }

  private async findDocument(
    organizationId: string,
    documentId: string,
  ): Promise<DocumentWithRelations> {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId: organizationId, deletedAt: null },
      include: { versions: true, links: true },
    });
    if (document === null) {
      throw new NotFoundException({
        message: 'Document not found',
        code: 'RESOURCE_NOT_FOUND',
      });
    }
    return document;
  }

  private throwUploadValidation(error: unknown): never {
    if (error instanceof Error && error.name === 'FILE_TOO_LARGE') {
      throw new HttpException(
        { message: 'File too large', code: 'FILE_TOO_LARGE' },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
    throw new UnprocessableEntityException({
      message: 'File type not allowed',
      code: 'FILE_TYPE_NOT_ALLOWED',
    });
  }

  private toResponse(document: DocumentWithRelations, includeRelations: boolean): DocumentResponse {
    const current =
      document.versions?.find((item) => item.id === document.currentVersionId) ??
      document.versions?.[0] ??
      null;

    return {
      id: document.id,
      organizationId: document.tenantId,
      title: document.title,
      category: document.category,
      visibility: document.visibility,
      retentionClass: document.retentionClass,
      status: document.status,
      legalHold: document.legalHold,
      currentVersionId: document.currentVersionId,
      createdByUserId: document.createdByUserId,
      version: document.version,
      ...(includeRelations
        ? {
            currentVersion: current !== null ? this.toVersionResponse(current) : null,
            links: (document.links ?? []).map((link) => this.toLinkResponse(link)),
          }
        : {}),
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
    };
  }

  private toVersionResponse(version: DocumentVersion): DocumentVersionResponse {
    return {
      id: version.id,
      documentId: version.documentId,
      versionNumber: version.versionNumber,
      objectKey: '[redacted]',
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      checksumSha256: version.checksumSha256,
      scanStatus: version.scanStatus,
      scanDetail: version.scanDetail,
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString(),
    };
  }

  private toLinkResponse(link: DocumentLink): DocumentLinkResponse {
    return {
      id: link.id,
      documentId: link.documentId,
      linkType: link.linkType,
      partyId: link.partyId,
      propertyId: link.propertyId,
      leaseId: link.leaseId,
      createdAt: link.createdAt.toISOString(),
      updatedAt: link.updatedAt.toISOString(),
    };
  }
}
