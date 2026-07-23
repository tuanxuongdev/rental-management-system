'use client';

import { PropertyOwnersList } from '@/features/parties';

export default function PortfolioOwnersPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Property owners</h1>
        <p className="text-muted-foreground text-sm">
          Beneficial owners recorded for the Organization portfolio.
        </p>
      </div>
      <PropertyOwnersList />
    </div>
  );
}
