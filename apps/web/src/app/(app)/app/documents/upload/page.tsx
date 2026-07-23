'use client';

import { Suspense } from 'react';

import { DocumentUploadForm } from '@/features/documents';

export default function DocumentUploadPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload document</h1>
        <p className="text-muted-foreground text-sm">
          Private upload with malware scan before download is available.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <DocumentUploadForm />
      </Suspense>
    </div>
  );
}
