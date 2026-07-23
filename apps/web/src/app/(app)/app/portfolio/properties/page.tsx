'use client';

import { PropertiesList } from '@/features/inventory';

export default function PortfolioPropertiesPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="text-muted-foreground text-sm">
          Organization portfolio properties in the active Property scope.
        </p>
      </div>
      <PropertiesList />
    </div>
  );
}
