'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useCreditNotes } from '../hooks/use-credit-notes';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, hasPermission } from '../utils/permissions';

export function CreditNotesList(): React.JSX.Element {
  const meQuery = useMe();
  const notesQuery = useCreditNotes();
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.invoicesList);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view credit notes.
      </p>
    );
  }

  if (notesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading credit notes…</p>;
  }

  if (notesQuery.isError) {
    const message =
      notesQuery.error instanceof AuthApiError
        ? notesQuery.error.message
        : 'Unable to load credit notes.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const notes = notesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Adjustments and reversals linked to invoices. Create and post flows remain server-driven.
      </p>
      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No credit notes yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Credit note</th>
                <th className="px-2 py-2 font-medium">Invoice</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {notes.map((note) => (
                <tr key={note.id} className="border-border border-b">
                  <td className="px-2 py-2">{note.creditNoteNumber ?? note.id.slice(0, 8)}</td>
                  <td className="px-2 py-2">
                    <Link href={`/app/finance/invoices/${note.invoiceId}`} className="underline">
                      {note.invoiceId.slice(0, 8)}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{note.status}</td>
                  <td className="px-2 py-2">{formatMoney(note.totalAmount, note.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
