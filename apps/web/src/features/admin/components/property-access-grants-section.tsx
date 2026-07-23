'use client';

import { useMemo, useState } from 'react';

import { Button, Label } from '@rpm/ui';

import { useProperties } from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import { useMe } from '../hooks/use-me';
import {
  useCreatePropertyAccessGrant,
  useEndPropertyAccessGrant,
  usePropertyAccessGrants,
} from '../hooks/use-property-access-grants';
import { ADMIN_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

function isActiveGrant(effectiveTo: string | null): boolean {
  if (effectiveTo === null) {
    return true;
  }
  return new Date(effectiveTo).getTime() > Date.now();
}

export function PropertyAccessGrantsSection({
  membershipId,
}: {
  membershipId: string;
}): React.JSX.Element {
  const meQuery = useMe();
  const grantsQuery = usePropertyAccessGrants(membershipId);
  const propertiesQuery = useProperties();
  const createGrant = useCreatePropertyAccessGrant(membershipId);
  const endGrant = useEndPropertyAccessGrant(membershipId);

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManage =
    canMutate(meQuery.data, ADMIN_PERMISSIONS.propertiesAssignStaff) ||
    canMutate(meQuery.data, ADMIN_PERMISSIONS.membersRolesAssign);
  const canView =
    canManage ||
    hasPermission(meQuery.data, ADMIN_PERMISSIONS.propertiesAssignStaff) ||
    hasPermission(meQuery.data, ADMIN_PERMISSIONS.membersRolesAssign);

  const propertyNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const property of propertiesQuery.data?.data ?? []) {
      map.set(property.id, `${property.code} — ${property.name}`);
    }
    return map;
  }, [propertiesQuery.data]);

  const activeGrants = (grantsQuery.data?.data ?? []).filter((grant) =>
    isActiveGrant(grant.effectiveTo),
  );
  const grantedPropertyIds = new Set(
    activeGrants
      .filter((grant) => grant.scopeType === 'SELECTED_PROPERTIES' && grant.propertyId !== null)
      .map((grant) => grant.propertyId as string),
  );
  const availableProperties = (propertiesQuery.data?.data ?? []).filter(
    (property) => !grantedPropertyIds.has(property.id),
  );

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to manage property access grants.
      </p>
    );
  }

  async function onAddGrant(): Promise<void> {
    setError(null);
    setSuccess(null);
    if (!selectedPropertyId) {
      setError('Select a property to grant.');
      return;
    }
    try {
      await createGrant.mutateAsync({
        scopeType: 'SELECTED_PROPERTIES',
        propertyId: selectedPropertyId,
        reason: 'Assigned by administrator',
      });
      setSelectedPropertyId('');
      setSuccess('Property access grant added.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to add grant.');
    }
  }

  async function onEndGrant(grantId: string): Promise<void> {
    setError(null);
    setSuccess(null);
    try {
      await endGrant.mutateAsync({
        grantId,
        body: { reason: 'Revoked by administrator' },
      });
      setSuccess('Property access grant ended.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to end grant.');
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Property access grants</h2>
      <p className="text-muted-foreground text-sm">
        Limits Property Manager inventory access to selected properties.
      </p>

      {grantsQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading grants…</p>
      ) : activeGrants.length === 0 ? (
        <p className="text-muted-foreground text-sm">No active property grants.</p>
      ) : (
        <ul className="space-y-2">
          {activeGrants.map((grant) => (
            <li
              key={grant.id}
              className="border-border flex flex-wrap items-center justify-between gap-2 border-b py-2 text-sm"
            >
              <span>
                {grant.scopeType === 'ALL_PROPERTIES'
                  ? 'All properties'
                  : (propertyNameById.get(grant.propertyId ?? '') ??
                    grant.propertyId ??
                    'Unknown property')}
              </span>
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={endGrant.isPending}
                  onClick={() => void onEndGrant(grant.id)}
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="grant-property">Add property</Label>
            <select
              id="grant-property"
              className="border-input bg-background h-9 min-w-[16rem] rounded-md border px-2 text-sm"
              value={selectedPropertyId}
              disabled={createGrant.isPending || propertiesQuery.isLoading}
              onChange={(event) => setSelectedPropertyId(event.target.value)}
            >
              <option value="">Select property…</option>
              {availableProperties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code} — {property.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            disabled={createGrant.isPending || !selectedPropertyId}
            onClick={() => void onAddGrant()}
          >
            {createGrant.isPending ? 'Adding…' : 'Add grant'}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
