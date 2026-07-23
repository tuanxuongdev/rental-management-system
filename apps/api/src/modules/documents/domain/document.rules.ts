import { DOCUMENT_MAX_SIZE_BYTES, type DocumentStatus } from '@rpm/contracts';

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
] as const;

const EXECUTABLE_EXTENSIONS = [
  '.exe',
  '.dll',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.sh',
  '.jar',
  '.app',
  '.dmg',
  '.bin',
] as const;

const EXECUTABLE_MIME_PREFIXES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-dosexec',
  'application/vnd.microsoft.portable-executable',
  'application/x-sh',
  'application/java-archive',
] as const;

export function isAllowedDocumentMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(normalized);
}

export function isExecutableFileName(fileName: string): boolean {
  const lower = fileName.trim().toLowerCase();
  return EXECUTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function isExecutableMimeType(mimeType: string): boolean {
  const normalized = mimeType.trim().toLowerCase();
  return EXECUTABLE_MIME_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix};`),
  );
}

export function assertDocumentUploadAllowed(input: {
  mimeType: string;
  sizeBytes: number;
  fileName: string;
}): void {
  if (input.sizeBytes > DOCUMENT_MAX_SIZE_BYTES) {
    const error = new Error('FILE_TOO_LARGE');
    error.name = 'FILE_TOO_LARGE';
    throw error;
  }
  if (
    isExecutableFileName(input.fileName) ||
    isExecutableMimeType(input.mimeType) ||
    !isAllowedDocumentMimeType(input.mimeType)
  ) {
    const error = new Error('FILE_TYPE_NOT_ALLOWED');
    error.name = 'FILE_TYPE_NOT_ALLOWED';
    throw error;
  }
}

/** Stub scanner: deny if MIME not allowlisted; otherwise READY. */
export function stubScanResult(mimeType: string): {
  status: Extract<DocumentStatus, 'READY' | 'REJECTED'>;
  detail: string | null;
} {
  if (!isAllowedDocumentMimeType(mimeType)) {
    return { status: 'REJECTED', detail: 'MIME_TYPE_DENIED' };
  }
  return { status: 'READY', detail: null };
}

export function clampDownloadTtlSeconds(requested: number | undefined): number {
  const DEFAULT = 300;
  const MAX = 900;
  if (requested === undefined) {
    return DEFAULT;
  }
  return Math.min(MAX, Math.max(1, requested));
}

export function relativePathFromObjectKey(organizationId: string, objectKey: string): string {
  const prefix = `org/${organizationId}/`;
  if (!objectKey.startsWith(prefix)) {
    throw new Error('OBJECT_KEY_TENANT_MISMATCH');
  }
  return objectKey.slice(prefix.length);
}
