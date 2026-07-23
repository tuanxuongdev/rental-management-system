'use client';

import { useParams } from 'next/navigation';

import { BedsList } from '@/features/inventory';

export default function PortfolioBedsPage(): React.JSX.Element {
  const params = useParams<{ unitId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Beds</h1>
        <p className="text-muted-foreground text-sm">Optional beds under a shared unit.</p>
      </div>
      <BedsList unitId={params.unitId} />
    </div>
  );
}
