'use client';

import { useMe } from '@/features/admin';
import {
  OWNER_NON_AUTHORIZING_BANNER,
  PORTFOLIO_PERMISSIONS,
  hasPermission,
} from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import { usePropertyOwner } from '../hooks/use-property-owners';

export function PropertyOwnerDetail({ ownerId }: { ownerId: string }): React.JSX.Element {
  const meQuery = useMe();
  const ownerQuery = usePropertyOwner(ownerId);
  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.propertyOwnersView);

  if (meQuery.isLoading || ownerQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading property owner…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this property owner.
      </p>
    );
  }

  if (ownerQuery.isError || !ownerQuery.data) {
    const message =
      ownerQuery.error instanceof AuthApiError
        ? ownerQuery.error.message
        : 'Property owner not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const owner = ownerQuery.data;

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm" role="note">
        {OWNER_NON_AUTHORIZING_BANNER}
      </div>

      <div>
        <h2 className="text-xl font-semibold tracking-tight">{owner.displayName}</h2>
        <p className="text-muted-foreground text-sm">
          {owner.ownerCategory} · {owner.status}
        </p>
      </div>

      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Party type</dt>
          <dd>{owner.partyType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Legal name</dt>
          <dd>{owner.legalName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Grants login access</dt>
          <dd>{owner.grantsLoginAccess ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Notes</dt>
          <dd>{owner.notes ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{owner.version}</dd>
        </div>
      </dl>
    </div>
  );
}
