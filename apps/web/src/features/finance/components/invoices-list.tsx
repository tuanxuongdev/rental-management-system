'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { InvoiceStatus } from '@rpm/contracts';
import { Input } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useInvoices } from '../hooks/use-invoices';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, hasPermission } from '../utils/permissions';

const STATUSES: Array<InvoiceStatus | ''> = [
  '',
  'DRAFT',
  'POSTED',
  'PARTIALLY_PAID',
  'PAID',
  'VOID',
];

export function InvoicesList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [periodKey, setPeriodKey] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | ''>('');
  const invoicesQuery = useInvoices({
    periodKey: periodKey.trim() || undefined,
    status: status || undefined,
    propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
  });
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.invoicesList);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list invoices.
      </p>
    );
  }

  if (invoicesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading invoices…</p>;
  }

  if (invoicesQuery.isError) {
    const message =
      invoicesQuery.error instanceof AuthApiError
        ? invoicesQuery.error.message
        : 'Unable to load invoices.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const invoices = invoicesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Invoices reflect posted charges from billing runs. Use Record payment on an open invoice to
        collect.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="invoice-period" className="text-muted-foreground text-xs">
            Period (YYYY-MM)
          </label>
          <Input
            id="invoice-period"
            value={periodKey}
            onChange={(event) => setPeriodKey(event.target.value)}
            placeholder="2026-07"
            className="w-36"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="invoice-status" className="text-muted-foreground text-xs">
            Status
          </label>
          <select
            id="invoice-status"
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as InvoiceStatus | '')}
          >
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {invoices.length === 0 ? (
        <p className="text-muted-foreground text-sm">No invoices match the current filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Invoice</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Total</th>
                <th className="px-2 py-2 font-medium">Balance</th>
                <th className="px-2 py-2 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link href={`/app/finance/invoices/${invoice.id}`} className="underline">
                      {invoice.invoiceNumber ?? invoice.id.slice(0, 8)}
                    </Link>
                    {invoice.periodKey ? (
                      <span className="text-muted-foreground block text-xs">
                        {invoice.periodKey}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">{invoice.status}</td>
                  <td className="px-2 py-2">
                    {formatMoney(invoice.totalAmount, invoice.currency)}
                  </td>
                  <td className="px-2 py-2">
                    {formatMoney(invoice.balanceAmount, invoice.currency)}
                  </td>
                  <td className="px-2 py-2">{invoice.dueDate ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
