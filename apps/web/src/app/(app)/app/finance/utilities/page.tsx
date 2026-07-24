'use client';

import { UtilityAllocationRun } from '@/features/finance';

export default function UtilitiesPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Utility allocation</h1>
        <p className="text-muted-foreground text-sm">
          Preview and commit shared utility charges for a service period.
        </p>
      </div>
      <UtilityAllocationRun />
    </div>
  );
}
