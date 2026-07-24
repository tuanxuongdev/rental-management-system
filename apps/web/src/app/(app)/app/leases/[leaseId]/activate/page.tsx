'use client';

import { useParams } from 'next/navigation';

import { LeaseActivate } from '@/features/leasing';

export default function LeaseActivatePage(): React.JSX.Element {
  const params = useParams<{ leaseId: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activate lease</h1>
        <p className="text-muted-foreground text-sm">
          Confirm consequences before locking terms and activating the allocation.
        </p>
      </div>
      <LeaseActivate leaseId={params.leaseId} />
    </div>
  );
}
