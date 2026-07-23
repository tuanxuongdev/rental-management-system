'use client';

import { useParams } from 'next/navigation';

import { PropertyDetail } from '@/features/inventory';

export default function PortfolioPropertyDetailPage(): React.JSX.Element {
  const params = useParams<{ propertyId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Property</h1>
        <p className="text-muted-foreground text-sm">Property detail and ownership links.</p>
      </div>
      <PropertyDetail propertyId={params.propertyId} />
    </div>
  );
}
