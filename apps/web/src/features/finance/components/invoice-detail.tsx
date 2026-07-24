'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useInvoice, usePostInvoice, useVoidInvoice } from '../hooks/use-invoices';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

type InvoiceDetailProps = {
  invoiceId: string;
};

export function InvoiceDetail({ invoiceId }: InvoiceDetailProps): React.JSX.Element {
  const meQuery = useMe();
  const invoiceQuery = useInvoice(invoiceId);
  const postMutation = usePostInvoice(invoiceId);
  const voidMutation = useVoidInvoice(invoiceId);
  const [voidReason, setVoidReason] = useState('');
  const [voidConfirmed, setVoidConfirmed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.invoicesView);
  const canIssue = canMutate(meQuery.data, FINANCE_PERMISSIONS.invoicesIssue);
  const canVoid = canMutate(meQuery.data, FINANCE_PERMISSIONS.chargesVoid);
  const canRecordPayment = canMutate(meQuery.data, FINANCE_PERMISSIONS.paymentsRecord);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this invoice.
      </p>
    );
  }

  if (invoiceQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading invoice…</p>;
  }

  if (invoiceQuery.isError || !invoiceQuery.data) {
    const message =
      invoiceQuery.error instanceof AuthApiError
        ? invoiceQuery.error.message
        : 'Unable to load invoice.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const invoice = invoiceQuery.data;
  const lines = invoice.lines ?? [];

  async function onPost(): Promise<void> {
    setActionError(null);
    try {
      await postMutation.mutateAsync({
        body: { postedAt: new Date().toISOString() },
        version: invoice.version,
      });
      await invoiceQuery.refetch();
    } catch (error) {
      setActionError(error instanceof AuthApiError ? error.message : 'Post failed.');
    }
  }

  async function onVoid(): Promise<void> {
    setActionError(null);
    if (!voidConfirmed) {
      setActionError('Confirm void before continuing.');
      return;
    }
    if (voidReason.trim().length < 3) {
      setActionError('Enter a void reason (at least 3 characters).');
      return;
    }
    try {
      await voidMutation.mutateAsync({
        body: {
          reason: voidReason.trim(),
          effectiveAt: new Date().toISOString(),
        },
        version: invoice.version,
      });
      setVoidConfirmed(false);
      await invoiceQuery.refetch();
    } catch (error) {
      setActionError(error instanceof AuthApiError ? error.message : 'Void failed.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/finance/invoices" className="text-muted-foreground text-sm underline">
          Back to invoices
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {invoice.invoiceNumber ?? 'Invoice'}
        </h1>
        <p className="text-muted-foreground text-sm">
          Status {invoice.status}
          {invoice.periodKey ? ` · Period ${invoice.periodKey}` : ''}
          {invoice.dueDate ? ` · Due ${invoice.dueDate}` : ''}
        </p>
        {canRecordPayment &&
        (invoice.status === 'POSTED' || invoice.status === 'PARTIALLY_PAID') &&
        invoice.balanceAmount !== '0' &&
        invoice.balanceAmount !== '0.0000' ? (
          <p className="mt-2 text-sm">
            <Link
              href={`/app/finance/payments/new?invoiceId=${invoice.id}&leaseId=${invoice.leaseId}&propertyId=${invoice.propertyId}&payerPartyId=${invoice.billToPartyId}&amount=${encodeURIComponent(invoice.balanceAmount)}&currency=${encodeURIComponent(invoice.currency)}`}
              className="underline"
            >
              Record payment
            </Link>
          </p>
        ) : null}
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd>{formatMoney(invoice.subtotalAmount, invoice.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Tax</dt>
          <dd>{formatMoney(invoice.taxAmount, invoice.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-medium">{formatMoney(invoice.totalAmount, invoice.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Balance due</dt>
          <dd className="font-medium">{formatMoney(invoice.balanceAmount, invoice.currency)}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Lines</h2>
        {lines.length === 0 ? (
          <p className="text-muted-foreground text-sm">No line detail returned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">Description</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-border border-b">
                    <td className="px-2 py-2">{line.lineNumber}</td>
                    <td className="px-2 py-2">{line.description}</td>
                    <td className="px-2 py-2">{formatMoney(line.lineAmount, line.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canIssue && invoice.status === 'DRAFT' ? (
        <div className="space-y-2">
          <Button type="button" onClick={() => void onPost()} disabled={postMutation.isPending}>
            Post invoice
          </Button>
        </div>
      ) : null}

      {canVoid && invoice.status === 'POSTED' ? (
        <div className="space-y-2 border-t pt-4">
          <Label htmlFor="void-reason">Void reason</Label>
          <Input
            id="void-reason"
            value={voidReason}
            onChange={(event) => setVoidReason(event.target.value)}
            className="max-w-md"
          />
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={voidConfirmed}
              onChange={(event) => setVoidConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>I confirm this posted invoice should be voided.</span>
          </label>
          <Button
            type="button"
            variant="destructive"
            onClick={() => void onVoid()}
            disabled={!voidConfirmed || voidMutation.isPending}
          >
            Void invoice
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
