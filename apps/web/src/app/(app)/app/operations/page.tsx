'use client';

import { OperationsList } from '@/features/imports';

export default function OperationsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Operations</h1>
        <p className="text-muted-foreground text-sm">
          Track durable import and export jobs for this Organization.
        </p>
      </div>
      <OperationsList />
    </div>
  );
}
