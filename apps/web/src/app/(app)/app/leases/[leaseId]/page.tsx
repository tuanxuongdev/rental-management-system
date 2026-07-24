'use client';

import { useParams } from 'next/navigation';

import { LeaseDetail } from '@/features/leasing';

export default function LeaseDetailPage(): React.JSX.Element {
  const params = useParams<{ leaseId: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lease</h1>
        <p className="text-muted-foreground text-sm">Parties, allocation, terms, and timeline.</p>
      </div>
      <LeaseDetail leaseId={params.leaseId} />
    </div>
  );
}
