'use client';

import { ArrearsList } from '@/features/finance';

export default function ArrearsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arrears</h1>
        <p className="text-muted-foreground text-sm">
          Unpaid invoices ordered by due date (thin Sprint-11 view).
        </p>
      </div>
      <ArrearsList />
    </div>
  );
}
