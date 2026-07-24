'use client';

import { BillingRunWorkspace } from '@/features/finance';

export default function BillingRunPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing run</h1>
        <p className="text-muted-foreground text-sm">
          Preview and commit recurring rent charges for a billing period.
        </p>
      </div>
      <BillingRunWorkspace />
    </div>
  );
}
