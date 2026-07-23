'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import {
  AGREEMENT_NON_AUTHORIZING_BANNER,
  PORTFOLIO_PERMISSIONS,
  canMutate,
  hasPermission,
} from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import { useManagementAgreements } from '../hooks/use-management-agreements';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

export function ManagementAgreementsList(): React.JSX.Element {
  const meQuery = useMe();
  const agreementsQuery = useManagementAgreements();
  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.managementAgreementsList);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.managementAgreementsCreate);

  if (meQuery.isLoading || agreementsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading management agreements…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list management agreements.
      </p>
    );
  }

  if (agreementsQuery.isError) {
    const message =
      agreementsQuery.error instanceof AuthApiError
        ? agreementsQuery.error.message
        : 'Unable to load management agreements.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const agreements = agreementsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm" role="note">
        {AGREEMENT_NON_AUTHORIZING_BANNER}
      </div>

      {canCreate ? (
        <div>
          <Link href="/app/portfolio/agreements/new" className={primaryLinkClass}>
            Create agreement
          </Link>
        </div>
      ) : null}

      {agreements.length === 0 ? (
        <p className="text-muted-foreground text-sm">No management agreements yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Agreement #</th>
                <th className="px-2 py-2 font-medium">Property</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Effective from</th>
                <th className="px-2 py-2 font-medium">Effective to</th>
              </tr>
            </thead>
            <tbody>
              {agreements.map((agreement) => (
                <tr key={agreement.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/portfolio/agreements/${agreement.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {agreement.agreementNumber}
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">{agreement.propertyId}</td>
                  <td className="px-2 py-2">{agreement.status}</td>
                  <td className="px-2 py-2">{agreement.effectiveFrom}</td>
                  <td className="px-2 py-2">{agreement.effectiveTo ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
