'use client';

import { InvoicesList } from '@/features/finance';

export default function InvoicesPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground text-sm">
          Posted and draft invoices for the active Property scope.
        </p>
      </div>
      <InvoicesList />
    </div>
  );
}
