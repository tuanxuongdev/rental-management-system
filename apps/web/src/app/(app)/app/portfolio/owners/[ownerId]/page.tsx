'use client';

import { useParams } from 'next/navigation';

import { PropertyOwnerDetail } from '@/features/parties';

export default function PortfolioOwnerDetailPage(): React.JSX.Element {
  const params = useParams<{ ownerId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Property owner</h1>
        <p className="text-muted-foreground text-sm">Property Owner party profile.</p>
      </div>
      <PropertyOwnerDetail ownerId={params.ownerId} />
    </div>
  );
}
