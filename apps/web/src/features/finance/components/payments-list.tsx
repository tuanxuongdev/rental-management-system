'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { usePayments } from '../hooks/use-payments';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function PaymentsList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const paymentsQuery = usePayments({
    propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
  });
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.paymentsList);
  const canRecord = canMutate(meQuery.data, FINANCE_PERMISSIONS.paymentsRecord);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list payments.
      </p>
    );
  }

  if (paymentsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading payments…</p>;
  }

  if (paymentsQuery.isError) {
    const message =
      paymentsQuery.error instanceof AuthApiError
        ? paymentsQuery.error.message
        : 'Unable to load payments.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const payments = paymentsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          Settled cash/bank collections and hosted sandbox payments. Posted payments are immutable.
        </p>
        {canRecord ? (
          <Link
            href="/app/finance/payments/new"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center rounded-md px-3 text-sm font-medium"
          >
            Record payment
          </Link>
        ) : null}
      </div>
      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No payments in scope.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Received</th>
                <th className="px-2 py-2 font-medium">Channel</th>
                <th className="px-2 py-2 font-medium">Amount</th>
                <th className="px-2 py-2 font-medium">Unallocated</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link href={`/app/finance/payments/${payment.id}`} className="underline">
                      {new Date(payment.receivedAt).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{payment.channel}</td>
                  <td className="px-2 py-2">{formatMoney(payment.amount, payment.currency)}</td>
                  <td className="px-2 py-2">
                    {formatMoney(payment.unallocatedAmount, payment.currency)}
                  </td>
                  <td className="px-2 py-2">{payment.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
