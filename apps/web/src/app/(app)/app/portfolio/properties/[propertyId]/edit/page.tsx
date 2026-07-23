'use client';

import { useParams } from 'next/navigation';

import { PropertyForm } from '@/features/inventory';

export default function PortfolioPropertyEditPage(): React.JSX.Element {
  const params = useParams<{ propertyId: string }>();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit property</h1>
        <p className="text-muted-foreground text-sm">
          Update property details with concurrency control.
        </p>
      </div>
      <PropertyForm mode="edit" propertyId={params.propertyId} />
    </div>
  );
}
