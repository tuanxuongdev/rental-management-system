'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useDocumentUpload } from '../hooks/use-document-upload';
import { DOCUMENT_PERMISSIONS, canMutate } from '../utils/permissions';

const CATEGORIES = [
  'IDENTITY',
  'LEASE_SUPPORTING',
  'INCOME',
  'INSURANCE',
  'INSPECTION',
  'OTHER',
] as const;

export function DocumentUploadForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partyId = searchParams.get('partyId') ?? undefined;
  const leaseId = searchParams.get('leaseId') ?? undefined;
  const meQuery = useMe();
  const upload = useDocumentUpload();
  const canUpload = canMutate(meQuery.data, DOCUMENT_PERMISSIONS.upload);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('OTHER');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canUpload) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to upload documents.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setStatusMessage(null);
    if (!file) {
      setError('Choose a file to upload.');
      return;
    }
    try {
      setStatusMessage('Creating upload intent…');
      const document = await upload.mutateAsync({
        title: title.trim() || file.name,
        category,
        file,
        partyId,
        leaseId,
      });
      setStatusMessage(`Upload complete. Scan status: ${document.status}`);
      router.push(`/app/documents/${document.id}`);
    } catch (caught) {
      setStatusMessage(null);
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to upload document.');
    }
  }

  return (
    <form
      className="mx-auto max-w-lg space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      {partyId ? (
        <p className="text-muted-foreground text-xs">
          Will link to party id {partyId.slice(0, 8)}…
        </p>
      ) : null}
      {leaseId ? (
        <p className="text-muted-foreground text-xs">
          Will link to lease id {leaseId.slice(0, 8)}…
        </p>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="text-muted-foreground text-sm" role="status">
          {statusMessage}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="document-title">Title (required)</Label>
        <Input
          id="document-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="document-category">Category (required)</Label>
        <select
          id="document-category"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={category}
          onChange={(event) => setCategory(event.target.value as (typeof CATEGORIES)[number])}
        >
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="document-file">File (required)</Label>
        <Input
          id="document-file"
          type="file"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/app/documents')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
