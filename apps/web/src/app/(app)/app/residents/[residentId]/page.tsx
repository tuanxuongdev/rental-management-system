'use client';

import { useParams } from 'next/navigation';

import { ResidentDetail } from '@/features/residents';

export default function ResidentDetailPage(): React.JSX.Element {
  const params = useParams<{ residentId: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Resident</h1>
        <p className="text-muted-foreground text-sm">Profile, contacts, and flags.</p>
      </div>
      <ResidentDetail residentId={params.residentId} />
    </div>
  );
}
