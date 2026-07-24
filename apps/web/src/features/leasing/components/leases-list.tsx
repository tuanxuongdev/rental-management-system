'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { LeaseStatus } from '@rpm/contracts';
import { Input } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useLeases } from '../hooks/use-leases';
import { formatMoney } from '../utils/format-money';
import { LEASE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

const STATUSES: Array<LeaseStatus | ''> = ['', 'DRAFT', 'ACTIVE', 'NOTICE', 'ENDED', 'CANCELLED'];

export function LeasesList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<LeaseStatus | ''>('');
  const leasesQuery = useLeases({
    q: q.trim() || undefined,
    status: status || undefined,
    propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
  });
  const canView = hasPermission(meQuery.data, LEASE_PERMISSIONS.list);
  const canCreate = canMutate(meQuery.data, LEASE_PERMISSIONS.create);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list leases.
      </p>
    );
  }

  if (leasesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading leases…</p>;
  }

  if (leasesQuery.isError) {
    const message =
      leasesQuery.error instanceof AuthApiError
        ? leasesQuery.error.message
        : 'Unable to load leases.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const leases = leasesQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Lease status is contractual only. Occupancy stays vacant until move-in (Sprint-09).
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="lease-q" className="text-muted-foreground text-xs">
            Search
          </label>
          <Input
            id="lease-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Lease number or resident"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="lease-status" className="text-muted-foreground text-xs">
            Status
          </label>
          <select
            id="lease-status"
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as LeaseStatus | '')}
          >
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All'}
              </option>
            ))}
          </select>
        </div>
        {canCreate ? (
          <Link href="/app/leases/new" className={primaryLinkClass}>
            Create lease
          </Link>
        ) : null}
      </div>

      {leases.length === 0 ? (
        <p className="text-muted-foreground text-sm">No leases yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Lease</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Rent</th>
                <th className="px-2 py-2 font-medium">Dates</th>
              </tr>
            </thead>
            <tbody>
              {leases.map((lease) => (
                <tr key={lease.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/leases/${lease.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {lease.leaseNumber ?? `Draft ${lease.id.slice(0, 8)}…`}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{lease.status}</td>
                  <td className="px-2 py-2">
                    {formatMoney(lease.terms?.rentAmount ?? null, lease.currency)}
                  </td>
                  <td className="px-2 py-2">
                    {lease.startDate}
                    {lease.endDate ? ` → ${lease.endDate}` : ' → open'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
