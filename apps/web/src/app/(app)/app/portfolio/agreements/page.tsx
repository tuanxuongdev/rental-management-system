'use client';

import { ManagementAgreementsList } from '@/features/parties';

export default function PortfolioAgreementsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Management agreements</h1>
        <p className="text-muted-foreground text-sm">
          Operational authority records for managed properties.
        </p>
      </div>
      <ManagementAgreementsList />
    </div>
  );
}
