'use client';

import { useParams } from 'next/navigation';
import { Suspense } from 'react';

import { UnitForm } from '@/features/inventory';

export default function PortfolioUnitEditPage(): React.JSX.Element {
  const params = useParams<{ unitId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit unit</h1>
        <p className="text-muted-foreground text-sm">
          Update unit details with concurrency control.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading…</p>}>
        <UnitForm mode="edit" unitId={params.unitId} />
      </Suspense>
    </div>
  );
}
