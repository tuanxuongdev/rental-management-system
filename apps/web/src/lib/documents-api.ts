import {
  ORGANIZATION_DOCUMENT_BY_ID_PATH,
  ORGANIZATION_DOCUMENT_COMPLETE_UPLOAD_PATH,
  ORGANIZATION_DOCUMENT_DOWNLOAD_URL_PATH,
  ORGANIZATION_DOCUMENT_LINKS_PATH,
  ORGANIZATION_DOCUMENT_UPLOAD_INTENTS_PATH,
  ORGANIZATION_DOCUMENTS_PATH,
  completeUploadRequestSchema,
  createDocumentLinkRequestSchema,
  documentLinkResponseSchema,
  documentResponseSchema,
  documentsCollectionSchema,
  downloadUrlRequestSchema,
  downloadUrlResponseSchema,
  uploadIntentRequestSchema,
  uploadIntentResponseSchema,
  type CompleteUploadRequest,
  type CreateDocumentLinkRequest,
  type DocumentLinkResponse,
  type DocumentResponse,
  type DocumentsCollection,
  type DownloadUrlRequest,
  type DownloadUrlResponse,
  type UploadIntentRequest,
  type UploadIntentResponse,
} from '@rpm/contracts';

import { authFetch } from './auth-api';

function orgPath(
  template: string,
  organizationId: string,
  extra: Record<string, string> = {},
): string {
  let path = template.replace('{organizationId}', encodeURIComponent(organizationId));
  for (const [key, value] of Object.entries(extra)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return path;
}

function withQuery(
  path: string,
  params: Record<string, string | number | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

export type ListDocumentsOptions = {
  limit?: number;
  after?: string;
  q?: string;
  category?: string;
  status?: string;
  propertyId?: string;
  residentId?: string;
  partyId?: string;
};

export async function listDocuments(
  accessToken: string,
  organizationId: string,
  options?: ListDocumentsOptions,
): Promise<DocumentsCollection> {
  const path = withQuery(orgPath(ORGANIZATION_DOCUMENTS_PATH, organizationId), {
    limit: options?.limit,
    after: options?.after,
    q: options?.q,
    category: options?.category,
    status: options?.status,
    propertyId: options?.propertyId,
    partyId: options?.residentId ?? options?.partyId,
  });
  const response = await authFetch(path, {}, accessToken);
  return documentsCollectionSchema.parse(await response.json());
}

export async function getDocument(
  accessToken: string,
  organizationId: string,
  documentId: string,
): Promise<DocumentResponse> {
  const path = orgPath(ORGANIZATION_DOCUMENT_BY_ID_PATH, organizationId, { documentId });
  const response = await authFetch(path, {}, accessToken);
  return documentResponseSchema.parse(await response.json());
}

export async function createUploadIntent(
  accessToken: string,
  organizationId: string,
  body: UploadIntentRequest,
): Promise<UploadIntentResponse> {
  uploadIntentRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DOCUMENT_UPLOAD_INTENTS_PATH, organizationId);
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return uploadIntentResponseSchema.parse(await response.json());
}

export async function uploadFileToIntent(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

export async function completeDocumentUpload(
  accessToken: string,
  organizationId: string,
  documentId: string,
  body: CompleteUploadRequest,
): Promise<DocumentResponse | null> {
  completeUploadRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DOCUMENT_COMPLETE_UPLOAD_PATH, organizationId, {
    documentId,
  });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  if (response.status === 202 || response.status === 204) {
    const text = await response.text();
    if (!text) {
      return null;
    }
    const parsed = documentResponseSchema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  }
  return documentResponseSchema.parse(await response.json());
}

export async function createDocumentDownloadUrl(
  accessToken: string,
  organizationId: string,
  documentId: string,
  body: DownloadUrlRequest = {},
): Promise<DownloadUrlResponse> {
  downloadUrlRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DOCUMENT_DOWNLOAD_URL_PATH, organizationId, { documentId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return downloadUrlResponseSchema.parse(await response.json());
}

export async function createDocumentLink(
  accessToken: string,
  organizationId: string,
  documentId: string,
  body: CreateDocumentLinkRequest,
): Promise<DocumentLinkResponse> {
  createDocumentLinkRequestSchema.parse(body);
  const path = orgPath(ORGANIZATION_DOCUMENT_LINKS_PATH, organizationId, { documentId });
  const response = await authFetch(
    path,
    { method: 'POST', body: JSON.stringify(body) },
    accessToken,
  );
  return documentLinkResponseSchema.parse(await response.json());
}

export async function sha256Hex(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function fileToBase64(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
