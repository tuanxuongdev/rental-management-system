'use client';

import { LeaseCreateWizard } from '@/features/leasing';

export default function NewLeasePage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create lease</h1>
        <p className="text-muted-foreground text-sm">
          Multi-step draft: parties, allocation, commercial terms, then review.
        </p>
      </div>
      <LeaseCreateWizard />
    </div>
  );
}
