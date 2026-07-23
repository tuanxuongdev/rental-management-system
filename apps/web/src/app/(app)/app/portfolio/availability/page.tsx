'use client';

import { AvailabilityLookup } from '@/features/inventory';

export default function PortfolioAvailabilityPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Availability</h1>
        <p className="text-muted-foreground text-sm">
          Look up available units or beds by property and filters.
        </p>
      </div>
      <AvailabilityLookup />
    </div>
  );
}
