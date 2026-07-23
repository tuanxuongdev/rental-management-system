'use client';

import { ResidentsList } from '@/features/residents';

export default function ResidentsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Residents</h1>
        <p className="text-muted-foreground text-sm">
          Organization resident profiles in the active Property scope.
        </p>
      </div>
      <ResidentsList />
    </div>
  );
}
