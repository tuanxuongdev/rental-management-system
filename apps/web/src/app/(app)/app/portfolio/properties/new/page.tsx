'use client';

import { PropertyForm } from '@/features/inventory';

export default function PortfolioPropertyCreatePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create property</h1>
        <p className="text-muted-foreground text-sm">
          Add a property to the Organization portfolio.
        </p>
      </div>
      <PropertyForm mode="create" />
    </div>
  );
}
