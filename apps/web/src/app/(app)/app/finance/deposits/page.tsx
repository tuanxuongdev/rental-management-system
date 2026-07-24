'use client';

import { DepositsList } from '@/features/finance';

export default function DepositsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deposits</h1>
        <p className="text-muted-foreground text-sm">
          Security deposit obligations linked to leases.
        </p>
      </div>
      <DepositsList />
    </div>
  );
}
