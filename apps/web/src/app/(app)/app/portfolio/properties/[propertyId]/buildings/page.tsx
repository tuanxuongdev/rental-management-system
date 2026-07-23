'use client';

import { useParams } from 'next/navigation';

import { BuildingsList } from '@/features/inventory';

export default function PortfolioBuildingsPage(): React.JSX.Element {
  const params = useParams<{ propertyId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Buildings</h1>
        <p className="text-muted-foreground text-sm">Buildings under this property.</p>
      </div>
      <BuildingsList propertyId={params.propertyId} />
    </div>
  );
}
