'use client';

import { useParams } from 'next/navigation';

import { InvoiceDetail } from '@/features/finance';

export default function InvoiceDetailPage(): React.JSX.Element {
  const params = useParams<{ invoiceId: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invoice</h1>
        <p className="text-muted-foreground text-sm">Lines, totals, and lifecycle actions.</p>
      </div>
      <InvoiceDetail invoiceId={params.invoiceId} />
    </div>
  );
}
