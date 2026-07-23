'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import {
  listOwnerships,
  createOwnership,
  endOwnership,
  listPropertyOwners,
} from '@/lib/portfolio-api';
import { useAuthStore } from '@/state/auth-store';

import { useArchiveProperty, useProperty } from '../hooks/use-properties';
import { PORTFOLIO_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function PropertyDetail({ propertyId }: { propertyId: string }): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const propertyQuery = useProperty(propertyId);
  const archiveProperty = useArchiveProperty(propertyId);
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [ownerPartyId, setOwnerPartyId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 16));

  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesView);
  const canUpdate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesUpdate);
  const canArchive = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesArchive);
  const canViewOwnerships = hasPermission(
    meQuery.data,
    PORTFOLIO_PERMISSIONS.propertyOwnershipsView,
  );
  const canCreateOwnership = canMutate(
    meQuery.data,
    PORTFOLIO_PERMISSIONS.propertyOwnershipsCreate,
  );
  const canEndOwnership = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertyOwnershipsEnd);

  const ownershipsQuery = useQuery({
    queryKey: ['parties', 'ownerships', organizationId, propertyId],
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listOwnerships(accessToken, organizationId, propertyId);
    },
    enabled: Boolean(accessToken && organizationId && propertyId && canViewOwnerships),
  });

  const ownersQuery = useQuery({
    queryKey: ['parties', 'owners', organizationId, 'picker'],
    queryFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return listPropertyOwners(accessToken, organizationId, { limit: 100 });
    },
    enabled: Boolean(accessToken && organizationId && canCreateOwnership),
  });

  const createOwnershipMutation = useMutation({
    mutationFn: () => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return createOwnership(accessToken, organizationId, propertyId, {
        ownerPartyId,
        interestType: 'EQUITY',
        effectiveFrom: new Date(effectiveFrom).toISOString(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['parties', 'ownerships', organizationId, propertyId],
      });
      setOwnerPartyId('');
    },
  });

  const endOwnershipMutation = useMutation({
    mutationFn: (ownershipId: string) => {
      if (!accessToken || !organizationId) {
        throw new Error('Organization context required');
      }
      return endOwnership(accessToken, organizationId, ownershipId, {
        effectiveTo: new Date().toISOString(),
        reason: 'Ended from property detail',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['parties', 'ownerships', organizationId, propertyId],
      });
    },
  });

  if (meQuery.isLoading || propertyQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading property…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this property.
      </p>
    );
  }

  if (propertyQuery.isError || !propertyQuery.data) {
    const message =
      propertyQuery.error instanceof AuthApiError
        ? propertyQuery.error.message
        : 'Property not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const property = propertyQuery.data;

  async function onArchive(): Promise<void> {
    if (!window.confirm(`Archive property ${property.code}?`)) {
      return;
    }
    setError(null);
    try {
      await archiveProperty.mutateAsync();
      router.push('/app/portfolio/properties');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to archive property.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {property.code} — {property.name}
          </h2>
          <p className="text-muted-foreground text-sm">Status: {property.status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Link
              href={`/app/portfolio/properties/${propertyId}/edit`}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Edit
            </Link>
          ) : null}
          <Link
            href={`/app/portfolio/properties/${propertyId}/buildings`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Buildings
          </Link>
          <Link
            href={`/app/portfolio/units?propertyId=${propertyId}`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Units
          </Link>
          {canArchive && property.status !== 'ARCHIVED' ? (
            <Button
              variant="destructive"
              onClick={() => void onArchive()}
              disabled={archiveProperty.isPending}
            >
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd>{property.propertyType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Address</dt>
          <dd>
            {property.addressLine1}
            {property.addressLine2 ? `, ${property.addressLine2}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">City</dt>
          <dd>{property.city}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Region</dt>
          <dd>{property.region ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Country</dt>
          <dd>{property.countryCode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Time zone</dt>
          <dd>{property.timeZone}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Currency</dt>
          <dd>{property.defaultCurrency}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{property.version}</dd>
        </div>
      </dl>

      {canViewOwnerships ? (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Ownerships</h3>
          <p className="text-muted-foreground text-xs">
            Recording a Property Owner does not grant application login access.
          </p>
          {ownershipsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading ownerships…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="px-2 py-2 font-medium">Owner party</th>
                    <th className="px-2 py-2 font-medium">Interest</th>
                    <th className="px-2 py-2 font-medium">From</th>
                    <th className="px-2 py-2 font-medium">To</th>
                    <th className="px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(ownershipsQuery.data?.data ?? []).map((row) => (
                    <tr key={row.id} className="border-border border-b">
                      <td className="px-2 py-2 font-mono text-xs">{row.ownerPartyId}</td>
                      <td className="px-2 py-2">{row.interestType}</td>
                      <td className="px-2 py-2">{row.effectiveFrom}</td>
                      <td className="px-2 py-2">{row.effectiveTo ?? '—'}</td>
                      <td className="px-2 py-2">{row.status}</td>
                      <td className="px-2 py-2">
                        {canEndOwnership && !row.effectiveTo ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={endOwnershipMutation.isPending}
                            onClick={() => void endOwnershipMutation.mutateAsync(row.id)}
                          >
                            End
                          </Button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {canCreateOwnership ? (
            <form
              className="flex max-w-xl flex-wrap items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void createOwnershipMutation.mutateAsync().catch((caught: unknown) => {
                  setError(
                    caught instanceof AuthApiError ? caught.message : 'Unable to create ownership.',
                  );
                });
              }}
            >
              <div className="space-y-1">
                <label htmlFor="ownerPartyId" className="text-xs font-medium">
                  Owner
                </label>
                <select
                  id="ownerPartyId"
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                  value={ownerPartyId}
                  onChange={(event) => setOwnerPartyId(event.target.value)}
                  required
                >
                  <option value="">Select owner…</option>
                  {(ownersQuery.data?.data ?? []).map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label htmlFor="effectiveFrom" className="text-xs font-medium">
                  Effective from
                </label>
                <input
                  id="effectiveFrom"
                  type="datetime-local"
                  className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
                  value={effectiveFrom}
                  onChange={(event) => setEffectiveFrom(event.target.value)}
                  required
                />
              </div>
              <Button type="submit" disabled={createOwnershipMutation.isPending || !ownerPartyId}>
                Link ownership
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
