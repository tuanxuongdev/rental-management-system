'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { useMe } from '@/features/admin';
import { FINANCE_PERMISSIONS, hasPermission as hasFinancePermission } from '@/features/finance';
import { AuthApiError } from '@/lib/auth-api';
import { getDashboardHome } from '@/lib/leases-api';
import { getFinanceDashboard } from '@/lib/payments-api';
import { useAuthStore } from '@/state/auth-store';

import { LEASE_PERMISSIONS, hasPermission } from '../utils/permissions';

export function HomeDashboard(): React.JSX.Element {
  const meQuery = useMe();
  const accessToken = useAuthStore((s) => s.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const canList = hasPermission(meQuery.data, LEASE_PERMISSIONS.list);
  const canFinance =
    hasFinancePermission(meQuery.data, FINANCE_PERMISSIONS.paymentsList) ||
    hasFinancePermission(meQuery.data, FINANCE_PERMISSIONS.invoicesList);

  const dashboardQuery = useQuery({
    queryKey: ['dashboard-home', organizationId],
    enabled: Boolean(accessToken && organizationId && canList),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getDashboardHome(accessToken, organizationId);
    },
  });

  const financeQuery = useQuery({
    queryKey: ['dashboard-finance-home', organizationId],
    enabled: Boolean(accessToken && organizationId && canFinance),
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return getFinanceDashboard(accessToken, organizationId);
    },
  });

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading workspace…</p>;
  }

  if (!canList) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-muted-foreground text-sm">
          Welcome. Lease pending-action widgets require leases.list permission.
        </p>
      </div>
    );
  }

  if (dashboardQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading dashboard…</p>;
  }

  if (dashboardQuery.isError || !dashboardQuery.data) {
    const message =
      dashboardQuery.error instanceof AuthApiError
        ? dashboardQuery.error.message
        : 'Unable to load dashboard.';
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
        <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
        <p className="text-muted-foreground text-sm">
          Exception queues for leasing operations. As of {new Date(data.asOf).toLocaleString()}.
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {data.financeNote}{' '}
          <Link href="/app/finance" className="underline">
            Open Finance
          </Link>
          .
          {canFinance && financeQuery.data ? (
            <>
              {' '}
              <Link href="/app/finance/arrears" className="underline">
                {financeQuery.data.unpaidInvoiceCount} unpaid invoice
                {financeQuery.data.unpaidInvoiceCount === 1 ? '' : 's'}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Move-ins due', value: data.moveInsDue },
          { label: 'Expiring soon', value: data.expiringSoon },
          { label: 'Move-outs due', value: data.moveOutsDue },
          { label: 'Holdovers', value: data.holdovers },
          { label: 'Checkouts open', value: data.checkoutsInProgress },
        ].map((card) => (
          <div key={card.label} className="border-border rounded-md border p-3">
            <p className="text-muted-foreground text-xs">{card.label}</p>
            <p className="text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Pending actions</h2>
        {data.actions.length === 0 ? (
          <p className="text-muted-foreground text-sm" role="status">
            No pending lease actions in the current window.
          </p>
        ) : (
          <ul className="divide-border divide-y rounded-md border">
            {data.actions.map((action) => (
              <li key={`${action.kind}-${action.leaseId}`} className="px-3 py-2 text-sm">
                <Link href={`/app/leases/${action.leaseId}`} className="font-medium underline">
                  {action.leaseNumber ?? action.leaseId.slice(0, 8)}
                </Link>
                <span className="text-muted-foreground">
                  {' '}
                  · {action.kind.replaceAll('_', ' ')}
                  {action.dueDate ? ` · due ${action.dueDate}` : ''}
                  {action.primaryPartyName ? ` · ${action.primaryPartyName}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/app/leases" className="underline">
          All leases
        </Link>
        <Link href="/app/leases" className="underline">
          Leasing queue
        </Link>
      </div>
    </div>
  );
}
