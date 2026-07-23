'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ResidentStatus } from '@rpm/contracts';
import { Input } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useResidents } from '../hooks/use-residents';
import { RESIDENT_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

const STATUSES: Array<ResidentStatus | ''> = ['', 'PROSPECT', 'ACTIVE', 'FORMER', 'ARCHIVED'];

export function ResidentsList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<ResidentStatus | ''>('');
  const residentsQuery = useResidents({
    q: q.trim() || undefined,
    status: status || undefined,
    propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
  });
  const canView = hasPermission(meQuery.data, RESIDENT_PERMISSIONS.list);
  const canCreate = canMutate(meQuery.data, RESIDENT_PERMISSIONS.create);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list residents.
      </p>
    );
  }

  if (residentsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading residents…</p>;
  }

  if (residentsQuery.isError) {
    const message =
      residentsQuery.error instanceof AuthApiError
        ? residentsQuery.error.message
        : 'Unable to load residents.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const residents = residentsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="resident-q" className="text-muted-foreground text-xs">
            Search
          </label>
          <Input
            id="resident-q"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Name or contact"
            className="w-56"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="resident-status" className="text-muted-foreground text-xs">
            Status
          </label>
          <select
            id="resident-status"
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as ResidentStatus | '')}
          >
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All'}
              </option>
            ))}
          </select>
        </div>
        {canCreate ? (
          <Link href="/app/residents/new" className={primaryLinkClass}>
            Create resident
          </Link>
        ) : null}
      </div>

      {residents.length === 0 ? (
        <p className="text-muted-foreground text-sm">No residents yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Preferred name</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Do not rent</th>
                <th className="px-2 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {residents.map((resident) => (
                <tr key={resident.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/residents/${resident.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {resident.displayName}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{resident.status}</td>
                  <td className="px-2 py-2">
                    {resident.activeDoNotRent?.status === 'ACTIVE' ? 'Yes' : 'No'}
                  </td>
                  <td className="px-2 py-2">{new Date(resident.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
