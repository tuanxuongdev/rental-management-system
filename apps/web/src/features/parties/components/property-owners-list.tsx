'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import {
  OWNER_NON_AUTHORIZING_BANNER,
  PORTFOLIO_PERMISSIONS,
  canMutate,
  hasPermission,
} from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import { usePropertyOwners } from '../hooks/use-property-owners';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

export function PropertyOwnersList(): React.JSX.Element {
  const meQuery = useMe();
  const ownersQuery = usePropertyOwners();
  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.propertyOwnersList);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertyOwnersCreate);

  if (meQuery.isLoading || ownersQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading property owners…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list property owners.
      </p>
    );
  }

  if (ownersQuery.isError) {
    const message =
      ownersQuery.error instanceof AuthApiError
        ? ownersQuery.error.message
        : 'Unable to load property owners.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const owners = ownersQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm" role="note">
        {OWNER_NON_AUTHORIZING_BANNER}
      </div>

      {canCreate ? (
        <div>
          <Link href="/app/portfolio/owners/new" className={primaryLinkClass}>
            Create property owner
          </Link>
        </div>
      ) : null}

      {owners.length === 0 ? (
        <p className="text-muted-foreground text-sm">No property owners yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Display name</th>
                <th className="px-2 py-2 font-medium">Party type</th>
                <th className="px-2 py-2 font-medium">Category</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {owners.map((owner) => (
                <tr key={owner.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/portfolio/owners/${owner.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {owner.displayName}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{owner.partyType}</td>
                  <td className="px-2 py-2">{owner.ownerCategory}</td>
                  <td className="px-2 py-2">{owner.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
