'use client';

import { Suspense } from 'react';

import { PaymentRecordForm } from '@/features/finance';

export default function NewPaymentPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record payment</h1>
        <p className="text-muted-foreground text-sm">
          Offline cash or bank transfer with optional invoice allocation.
        </p>
      </div>
      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading form…</p>}>
        <PaymentRecordForm />
      </Suspense>
    </div>
  );
}
