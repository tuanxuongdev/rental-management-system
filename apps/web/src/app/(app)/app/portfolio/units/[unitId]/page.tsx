'use client';

import { useParams } from 'next/navigation';

import { UnitDetail } from '@/features/inventory';

export default function PortfolioUnitDetailPage(): React.JSX.Element {
  const params = useParams<{ unitId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Unit</h1>
        <p className="text-muted-foreground text-sm">Unit detail, status, and related beds.</p>
      </div>
      <UnitDetail unitId={params.unitId} />
    </div>
  );
}
