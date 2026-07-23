'use client';

import { ManagementAgreementForm } from '@/features/parties';

export default function PortfolioAgreementCreatePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create management agreement</h1>
        <p className="text-muted-foreground text-sm">
          Record a management agreement without granting application login access.
        </p>
      </div>
      <ManagementAgreementForm />
    </div>
  );
}
