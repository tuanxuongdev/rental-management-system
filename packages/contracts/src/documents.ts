import { z } from 'zod';

import { createCursorCollectionSchema } from './pagination';
import { PERMISSION_KEYS } from './permissions';

export const DOCUMENT_PERMISSION_KEYS = {
  LIST: PERMISSION_KEYS.DOCUMENTS_LIST,
  VIEW: PERMISSION_KEYS.DOCUMENTS_VIEW,
  UPLOAD: PERMISSION_KEYS.DOCUMENTS_UPLOAD,
  DELETE: PERMISSION_KEYS.DOCUMENTS_DELETE,
} as const;

export const ORGANIZATION_DOCUMENTS_PATH = '/v1/organizations/{organizationId}/documents' as const;
export const ORGANIZATION_DOCUMENT_BY_ID_PATH =
  '/v1/organizations/{organizationId}/documents/{documentId}' as const;
export const ORGANIZATION_DOCUMENT_UPLOAD_INTENTS_PATH =
  '/v1/organizations/{organizationId}/documents/upload-intents' as const;
export const ORGANIZATION_DOCUMENT_COMPLETE_UPLOAD_PATH =
  '/v1/organizations/{organizationId}/documents/{documentId}/complete-upload' as const;
export const ORGANIZATION_DOCUMENT_DOWNLOAD_URL_PATH =
  '/v1/organizations/{organizationId}/documents/{documentId}/download-url' as const;
export const ORGANIZATION_DOCUMENT_CONTENT_PATH =
  '/v1/organizations/{organizationId}/documents/{documentId}/content' as const;
export const ORGANIZATION_DOCUMENT_LINKS_PATH =
  '/v1/organizations/{organizationId}/documents/{documentId}/links' as const;
export const ORGANIZATION_DOCUMENT_LINK_BY_ID_PATH =
  '/v1/organizations/{organizationId}/documents/{documentId}/links/{linkId}' as const;

export const documentStatusSchema = z.enum([
  'UPLOADING',
  'SCANNING',
  'READY',
  'REJECTED',
  'DELETED',
]);
export type DocumentStatus = z.infer<typeof documentStatusSchema>;

export const documentVisibilitySchema = z.enum([
  'STAFF',
  'RESIDENT_SHARED',
  'OWNER_SHARED',
  'RESTRICTED',
]);
export type DocumentVisibility = z.infer<typeof documentVisibilitySchema>;

export const DOCUMENT_MAX_SIZE_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_DOWNLOAD_TTL_DEFAULT_SECONDS = 300;
export const DOCUMENT_DOWNLOAD_TTL_MAX_SECONDS = 900;

export const uploadIntentRequestSchema = z
  .object({
    title: z.string().min(1).max(200),
    category: z.string().min(1).max(64),
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(128),
    sizeBytes: z.number().int().positive().max(DOCUMENT_MAX_SIZE_BYTES),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    visibility: documentVisibilitySchema.optional(),
    retentionClass: z.string().min(1).max(64).optional(),
    /** Optional party link at upload time (resident). */
    partyId: z.string().uuid().optional(),
    propertyId: z.string().uuid().optional(),
    leaseId: z.string().uuid().optional(),
    linkType: z.string().min(1).max(64).optional(),
    /**
     * Test / local helper: when provided, bytes are written during upload-intent
     * so complete-upload can verify without a separate PUT.
     */
    contentBase64: z.string().min(1).max(35_000_000).optional(),
  })
  .refine(
    (value) =>
      [value.partyId, value.propertyId, value.leaseId].filter((item) => item !== undefined)
        .length <= 1,
    {
      message: 'Provide at most one of partyId, propertyId, or leaseId on upload intent',
    },
  );
export type UploadIntentRequest = z.infer<typeof uploadIntentRequestSchema>;

export const documentVersionResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  objectKey: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string(),
  scanStatus: documentStatusSchema,
  scanDetail: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DocumentVersionResponse = z.infer<typeof documentVersionResponseSchema>;

export const documentLinkResponseSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  linkType: z.string(),
  partyId: z.string().uuid().nullable(),
  propertyId: z.string().uuid().nullable(),
  leaseId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DocumentLinkResponse = z.infer<typeof documentLinkResponseSchema>;

export const documentResponseSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string(),
  category: z.string(),
  visibility: documentVisibilitySchema,
  retentionClass: z.string(),
  status: documentStatusSchema,
  legalHold: z.boolean(),
  currentVersionId: z.string().uuid().nullable(),
  createdByUserId: z.string().uuid(),
  version: z.number().int().positive(),
  currentVersion: documentVersionResponseSchema.nullable().optional(),
  links: z.array(documentLinkResponseSchema).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;

export const documentsCollectionSchema = createCursorCollectionSchema(documentResponseSchema);
export type DocumentsCollection = z.infer<typeof documentsCollectionSchema>;

export const uploadIntentResponseSchema = z.object({
  document: documentResponseSchema,
  versionId: z.string().uuid(),
  objectKey: z.string(),
  uploadUrl: z.string().nullable(),
  expiresAt: z.string().datetime(),
  maxSizeBytes: z.number().int().positive(),
  allowedMimeTypes: z.array(z.string()),
});
export type UploadIntentResponse = z.infer<typeof uploadIntentResponseSchema>;

export const completeUploadRequestSchema = z.object({
  versionId: z.string().uuid(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  sizeBytes: z.number().int().positive().max(DOCUMENT_MAX_SIZE_BYTES),
  /** Optional when object was not written during intent (local/test). */
  contentBase64: z.string().min(1).max(35_000_000).optional(),
});
export type CompleteUploadRequest = z.infer<typeof completeUploadRequestSchema>;

export const downloadUrlRequestSchema = z.object({
  versionId: z.string().uuid().optional(),
  expiresInSeconds: z.number().int().min(1).max(DOCUMENT_DOWNLOAD_TTL_MAX_SECONDS).optional(),
  disposition: z.enum(['ATTACHMENT', 'INLINE']).optional(),
});
export type DownloadUrlRequest = z.infer<typeof downloadUrlRequestSchema>;

export const downloadUrlResponseSchema = z.object({
  url: z.string().min(1),
  /** s3 = signed capability URL; authenticated = call content endpoint with Bearer. */
  mode: z.enum(['s3', 'authenticated']).default('authenticated'),
  expiresAt: z.string().datetime(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  checksumSha256: z.string(),
  expiresInSeconds: z.number().int().positive(),
});
export type DownloadUrlResponse = z.infer<typeof downloadUrlResponseSchema>;

export const createDocumentLinkRequestSchema = z
  .object({
    linkType: z.string().min(1).max(64),
    partyId: z.string().uuid().optional(),
    propertyId: z.string().uuid().optional(),
    leaseId: z.string().uuid().optional(),
  })
  .refine(
    (value) =>
      [value.partyId, value.propertyId, value.leaseId].filter((item) => item !== undefined)
        .length === 1,
    { message: 'Exactly one of partyId, propertyId, leaseId is required' },
  );
export type CreateDocumentLinkRequest = z.infer<typeof createDocumentLinkRequestSchema>;
