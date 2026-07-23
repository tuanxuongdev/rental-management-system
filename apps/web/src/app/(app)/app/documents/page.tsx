'use client';

import { Suspense } from 'react';

import { DocumentsList } from '@/features/documents';

export default function DocumentsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-muted-foreground text-sm">
          Organization document library with scan status and short-lived downloads.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading documents…</p>}>
        <DocumentsList />
      </Suspense>
    </div>
  );
}
