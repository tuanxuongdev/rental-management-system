'use client';

import { PropertyOwnerForm } from '@/features/parties';

export default function PortfolioOwnerCreatePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create property owner</h1>
        <p className="text-muted-foreground text-sm">
          Record a Property Owner without granting application login access.
        </p>
      </div>
      <PropertyOwnerForm />
    </div>
  );
}
