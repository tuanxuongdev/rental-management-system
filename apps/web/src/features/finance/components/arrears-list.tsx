'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useInvoiceAging } from '../hooks/use-reconciliation';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, hasPermission } from '../utils/permissions';

export function ArrearsList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('USD');
  const agingQuery = useInvoiceAging(
    asOf,
    currency,
    propertyScope === 'ALL' ? undefined : propertyScope,
  );
  const canView =
    hasPermission(meQuery.data, FINANCE_PERMISSIONS.reportsView) ||
    hasPermission(meQuery.data, FINANCE_PERMISSIONS.paymentsList) ||
    hasPermission(meQuery.data, FINANCE_PERMISSIONS.invoicesList);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view arrears.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Arrears / Aging</h1>
        <p className="text-muted-foreground text-sm">
          Outstanding invoices by aging bucket as of a business date.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="asOf">As of</Label>
          <Input id="asOf" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </div>
        <Button type="button" onClick={() => void agingQuery.refetch()}>
          Refresh
        </Button>
      </div>

      {agingQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading aging…</p>
      ) : agingQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {agingQuery.error instanceof AuthApiError
            ? agingQuery.error.message
            : 'Unable to load aging.'}
        </p>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-5">
            {(agingQuery.data?.buckets ?? []).map((bucket) => (
              <div key={bucket.bucket} className="border-border rounded-md border p-3 text-sm">
                <div className="font-medium">{bucket.bucket}</div>
                <div>
                  {bucket.count} · {formatMoney(bucket.amount, currency)}
                </div>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-2 py-2 font-medium">Invoice</th>
                  <th className="px-2 py-2 font-medium">Due</th>
                  <th className="px-2 py-2 font-medium">Bucket</th>
                  <th className="px-2 py-2 font-medium">Days</th>
                  <th className="px-2 py-2 font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {(agingQuery.data?.accounts ?? []).map((item) => (
                  <tr key={item.invoiceId} className="border-border border-b">
                    <td className="px-2 py-2">
                      <Link href={`/app/finance/invoices/${item.invoiceId}`} className="underline">
                        {item.invoiceNumber ?? item.invoiceId.slice(0, 8)}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{item.dueDate ?? '—'}</td>
                    <td className="px-2 py-2">{item.bucket}</td>
                    <td className="px-2 py-2">{item.daysPastDue ?? '—'}</td>
                    <td className="px-2 py-2">{formatMoney(item.balanceAmount, item.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
