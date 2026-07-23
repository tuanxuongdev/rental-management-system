'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useResident } from '../hooks/use-residents';
import { RESIDENT_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

import { DoNotRentPanel } from './do-not-rent-panel';

export function ResidentDetail({ residentId }: { residentId: string }): React.JSX.Element {
  const meQuery = useMe();
  const residentQuery = useResident(residentId);
  const canView = hasPermission(meQuery.data, RESIDENT_PERMISSIONS.view);
  const canUpdate = canMutate(meQuery.data, RESIDENT_PERMISSIONS.update);
  const canSeeSensitive = hasPermission(meQuery.data, RESIDENT_PERMISSIONS.sensitiveDataView);

  if (meQuery.isLoading || residentQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading resident…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this resident.
      </p>
    );
  }

  if (residentQuery.isError || !residentQuery.data) {
    const message =
      residentQuery.error instanceof AuthApiError
        ? residentQuery.error.message
        : 'Resident not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const resident = residentQuery.data;
  const email = resident.contacts?.find((contact) => contact.type === 'EMAIL')?.value;
  const phone = resident.contacts?.find((contact) => contact.type === 'PHONE')?.value;
  const hasDoNotRent = Boolean(
    resident.activeDoNotRent && resident.activeDoNotRent.status === 'ACTIVE',
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{resident.displayName}</h2>
          <p className="text-muted-foreground text-sm">
            {resident.status}
            {hasDoNotRent ? ' · Do not rent' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Link
              href={`/app/residents/${residentId}/edit`}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Edit
            </Link>
          ) : null}
          <Link
            href={`/app/documents?residentId=${encodeURIComponent(residentId)}&partyId=${encodeURIComponent(resident.partyId)}`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Documents
          </Link>
        </div>
      </div>

      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Legal name</dt>
          <dd>{resident.legalName ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Preferred property</dt>
          <dd>{resident.preferredPropertyId ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{canSeeSensitive ? (email ?? '—') : email ? '••••••••' : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Phone</dt>
          <dd>{canSeeSensitive ? (phone ?? '—') : phone ? '••••••••' : '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Date of birth</dt>
          <dd>
            {canSeeSensitive
              ? (resident.dateOfBirth ?? resident.dateOfBirthMasked ?? '—')
              : (resident.dateOfBirthMasked ?? (resident.dateOfBirth ? '••••••••' : '—'))}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Notes</dt>
          <dd>{resident.notes ?? '—'}</dd>
        </div>
      </dl>

      <DoNotRentPanel residentId={residentId} />
    </div>
  );
}
