'use client';

import { ImportWizard } from '@/features/imports';

export default function AdminImportsPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Imports</h1>
        <p className="text-muted-foreground text-sm">
          Upload inventory CSV, dry-run validation, then commit asynchronously.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
