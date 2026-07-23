'use client';

import { UnitsList } from '@/features/inventory';

export default function PortfolioUnitsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Units</h1>
        <p className="text-muted-foreground text-sm">
          Units filtered by the active Property scope.
        </p>
      </div>
      <UnitsList />
    </div>
  );
}
