'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useFinanceDashboard } from '../hooks/use-payments';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, hasPermission } from '../utils/permissions';

export function FinanceDashboard(): React.JSX.Element {
  const meQuery = useMe();
  const dashboardQuery = useFinanceDashboard();
  const canView =
    hasPermission(meQuery.data, FINANCE_PERMISSIONS.paymentsList) ||
    hasPermission(meQuery.data, FINANCE_PERMISSIONS.invoicesList) ||
    hasPermission(meQuery.data, FINANCE_PERMISSIONS.reportsView);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view the finance dashboard.
      </p>
    );
  }

  if (dashboardQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading finance dashboard…</p>;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    const message =
      dashboardQuery.error instanceof AuthApiError
        ? dashboardQuery.error.message
        : 'Unable to load finance dashboard.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const data = dashboardQuery.data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
        <p className="text-muted-foreground text-sm">
          Collection snapshot as of {new Date(data.asOf).toLocaleString()}.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">{data.financeNote}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Outstanding',
            value: formatMoney(data.outstandingTotal, data.currency),
          },
          { label: 'Unpaid invoices', value: String(data.unpaidInvoiceCount) },
          {
            label: 'Collected this period',
            value: formatMoney(data.collectedThisPeriod, data.currency),
          },
          {
            label: 'Deposits held',
            value: formatMoney(data.depositsHeldTotal, data.currency),
          },
        ].map((card) => (
          <div key={card.label} className="border-border rounded-md border p-3">
            <p className="text-muted-foreground text-xs">{card.label}</p>
            <p className="text-xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/app/finance/payments" className="underline">
          Payments
        </Link>
        <Link href="/app/finance/arrears" className="underline">
          Arrears
        </Link>
        <Link href="/app/finance/invoices" className="underline">
          Invoices
        </Link>
        <Link href="/app/finance/deposits" className="underline">
          Deposits
        </Link>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recent payments</h2>
        {data.recentPayments.length === 0 ? (
          <p className="text-muted-foreground text-sm">No recent payments.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.recentPayments.map((payment) => (
              <li key={payment.id}>
                <Link href={`/app/finance/payments/${payment.id}`} className="underline">
                  {new Date(payment.receivedAt).toLocaleDateString()}
                </Link>
                {' · '}
                {payment.channel}
                {' · '}
                {formatMoney(payment.amount, payment.currency)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
