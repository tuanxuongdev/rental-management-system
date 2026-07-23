'use client';

import { useState } from 'react';

import { Button } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError, authFetch } from '@/lib/auth-api';
import { createDocumentDownloadUrl } from '@/lib/documents-api';
import { useAuthStore } from '@/state/auth-store';

import { useDocument } from '../hooks/use-documents';
import { DOCUMENT_PERMISSIONS, hasPermission } from '../utils/permissions';

export function DocumentDetail({ documentId }: { documentId: string }): React.JSX.Element {
  const meQuery = useMe();
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const documentQuery = useDocument(documentId);
  const canView = hasPermission(meQuery.data, DOCUMENT_PERMISSIONS.view);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  if (meQuery.isLoading || documentQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading document…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this document.
      </p>
    );
  }

  if (documentQuery.isError || !documentQuery.data) {
    const message =
      documentQuery.error instanceof AuthApiError
        ? documentQuery.error.message
        : 'Document not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const doc = documentQuery.data;
  const canDownload = doc.status === 'READY';

  async function onDownload(): Promise<void> {
    if (!accessToken || !organizationId) {
      setError('Organization context required');
      return;
    }
    setError(null);
    setDownloading(true);
    try {
      const result = await createDocumentDownloadUrl(accessToken, organizationId, documentId, {
        disposition: 'ATTACHMENT',
      });
      if (result.mode === 's3') {
        window.open(result.url, '_blank', 'noopener,noreferrer');
        return;
      }
      const response = await authFetch(result.url, { headers: { Accept: '*/*' } }, accessToken);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = globalThis.document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = doc.currentVersion?.fileName ?? 'document';
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to download document.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{doc.title}</h2>
        <p className="text-muted-foreground text-sm">
          {doc.category} · {doc.status}
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Visibility</dt>
          <dd>{doc.visibility}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Retention</dt>
          <dd>{doc.retentionClass}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Legal hold</dt>
          <dd>{doc.legalHold ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Current version</dt>
          <dd>
            {doc.currentVersion
              ? `${doc.currentVersion.fileName} (${doc.currentVersion.scanStatus})`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Mime type</dt>
          <dd>{doc.currentVersion?.mimeType ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Size</dt>
          <dd>
            {doc.currentVersion ? `${doc.currentVersion.sizeBytes.toLocaleString()} bytes` : '—'}
          </dd>
        </div>
      </dl>

      {doc.status === 'SCANNING' || doc.status === 'UPLOADING' ? (
        <p className="text-muted-foreground text-sm" role="status">
          Scan in progress ({doc.status}). This page refreshes automatically.
        </p>
      ) : null}

      {doc.status === 'REJECTED' ? (
        <p className="text-sm text-red-600" role="alert">
          This document was rejected by malware/content scanning and cannot be downloaded.
        </p>
      ) : null}

      <Button
        type="button"
        disabled={!canDownload || downloading}
        onClick={() => void onDownload()}
      >
        {downloading ? 'Preparing…' : 'Download'}
      </Button>
    </div>
  );
}
