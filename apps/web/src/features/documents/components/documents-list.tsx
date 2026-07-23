'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import type { DocumentStatus } from '@rpm/contracts';
import { Input } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useDocuments } from '../hooks/use-documents';
import { DOCUMENT_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

const STATUSES: Array<DocumentStatus | ''> = [
  '',
  'UPLOADING',
  'SCANNING',
  'READY',
  'REJECTED',
  'DELETED',
];

export function DocumentsList(): React.JSX.Element {
  const meQuery = useMe();
  const searchParams = useSearchParams();
  const residentIdFromQuery = searchParams.get('residentId') ?? undefined;
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<DocumentStatus | ''>('');

  const documentsQuery = useDocuments({
    q: q.trim() || undefined,
    category: category.trim() || undefined,
    status: status || undefined,
    propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
    residentId: residentIdFromQuery,
  });

  const canView = hasPermission(meQuery.data, DOCUMENT_PERMISSIONS.list);
  const canUpload = canMutate(meQuery.data, DOCUMENT_PERMISSIONS.upload);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list documents.
      </p>
    );
  }

  if (documentsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading documents…</p>;
  }

  if (documentsQuery.isError) {
    const message =
      documentsQuery.error instanceof AuthApiError
        ? documentsQuery.error.message
        : 'Unable to load documents.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const documents = documentsQuery.data?.data ?? [];
  const uploadHref = (() => {
    const params = new URLSearchParams();
    if (residentIdFromQuery) {
      params.set('residentId', residentIdFromQuery);
    }
    const partyId = searchParams.get('partyId');
    if (partyId) {
      params.set('partyId', partyId);
    }
    const query = params.toString();
    return query ? `/app/documents/upload?${query}` : '/app/documents/upload';
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="document-q" className="text-muted-foreground text-xs">
            Search
          </label>
          <Input
            id="document-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Title"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="document-category" className="text-muted-foreground text-xs">
            Category
          </label>
          <Input
            id="document-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="document-status" className="text-muted-foreground text-xs">
            Scan status
          </label>
          <select
            id="document-status"
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as DocumentStatus | '')}
          >
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All'}
              </option>
            ))}
          </select>
        </div>
        {canUpload ? (
          <Link href={uploadHref} className={primaryLinkClass}>
            Upload document
          </Link>
        ) : null}
      </div>

      {residentIdFromQuery ? (
        <p className="text-muted-foreground text-xs">
          Filtered to resident id {residentIdFromQuery.slice(0, 8)}…
        </p>
      ) : null}

      {documents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No documents yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Title</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Visibility</th>
                <th className="px-2 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/documents/${document.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {document.title}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{document.category}</td>
                  <td className="px-2 py-2">{document.status}</td>
                  <td className="px-2 py-2">{document.visibility}</td>
                  <td className="px-2 py-2">{new Date(document.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
