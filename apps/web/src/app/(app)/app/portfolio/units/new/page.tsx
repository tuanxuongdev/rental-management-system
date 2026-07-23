'use client';

import { Suspense } from 'react';

import { UnitForm } from '@/features/inventory';

export default function PortfolioUnitCreatePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create unit</h1>
        <p className="text-muted-foreground text-sm">Add a unit under a property.</p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <UnitForm mode="create" />
      </Suspense>
    </div>
  );
}
