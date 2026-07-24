'use client';

import { PaymentsList } from '@/features/finance';

export default function PaymentsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground text-sm">
          Cash, bank, and sandbox collection history for the active Property scope.
        </p>
      </div>
      <PaymentsList />
    </div>
  );
}
