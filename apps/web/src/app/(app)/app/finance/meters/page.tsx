'use client';

import { MetersList } from '@/features/finance';

export default function MetersPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meters</h1>
        <p className="text-muted-foreground text-sm">Meter registry and bulk reading entry.</p>
      </div>
      <MetersList />
    </div>
  );
}
