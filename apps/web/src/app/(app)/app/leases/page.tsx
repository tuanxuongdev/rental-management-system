'use client';

import { LeasesList } from '@/features/leasing';

export default function LeasesPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leases</h1>
        <p className="text-muted-foreground text-sm">
          Draft and active leases in the active Property scope.
        </p>
      </div>
      <LeasesList />
    </div>
  );
}
