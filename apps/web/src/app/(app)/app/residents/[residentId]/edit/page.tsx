'use client';

import { useParams } from 'next/navigation';

import { ResidentForm } from '@/features/residents';

export default function EditResidentPage(): React.JSX.Element {
  const params = useParams<{ residentId: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit resident</h1>
        <p className="text-muted-foreground text-sm">
          Updates use If-Match concurrency. Duplicate check runs before save.
        </p>
      </div>
      <ResidentForm mode="edit" residentId={params.residentId} />
    </div>
  );
}
