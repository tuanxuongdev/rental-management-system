'use client';

import { CreditNotesList } from '@/features/finance';

export default function CreditNotesPage(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Credit notes</h1>
        <p className="text-muted-foreground text-sm">Invoice adjustments and reversals.</p>
      </div>
      <CreditNotesList />
    </div>
  );
}
