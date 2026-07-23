'use client';

import { ResidentForm } from '@/features/residents';

export default function NewResidentPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create resident</h1>
        <p className="text-muted-foreground text-sm">
          Preferred name is required. Duplicate check runs before create.
        </p>
      </div>
      <ResidentForm mode="create" />
    </div>
  );
}
