'use client';

import { useParams } from 'next/navigation';

import { DocumentDetail } from '@/features/documents';

export default function DocumentDetailPage(): React.JSX.Element {
  const params = useParams<{ documentId: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Document</h1>
        <p className="text-muted-foreground text-sm">Metadata, scan status, and download.</p>
      </div>
      <DocumentDetail documentId={params.documentId} />
    </div>
  );
}
