'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { UnitStatusRequest } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

type InventoryOperationalStatus = UnitStatusRequest['status'];

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useArchiveUnit, useUnit, useUpdateUnitStatus } from '../hooks/use-units';
import { PORTFOLIO_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const OPERATIONAL_STATUSES: InventoryOperationalStatus[] = [
  'ACTIVE',
  'UNAVAILABLE',
  'UNDER_MAINTENANCE',
  'RETIRED',
];

export function UnitDetail({ unitId }: { unitId: string }): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const unitQuery = useUnit(unitId);
  const archiveUnit = useArchiveUnit(unitId);
  const updateStatus = useUpdateUnitStatus(unitId);
  const [status, setStatus] = useState<InventoryOperationalStatus>('ACTIVE');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.unitsView);
  const canUpdate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.unitsUpdate);
  const canArchive = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.unitsArchive);

  if (meQuery.isLoading || unitQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading unit…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this unit.
      </p>
    );
  }

  if (unitQuery.isError || !unitQuery.data) {
    const message =
      unitQuery.error instanceof AuthApiError ? unitQuery.error.message : 'Unit not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const unit = unitQuery.data;

  async function onArchive(): Promise<void> {
    if (!window.confirm(`Archive unit ${unit.code}?`)) {
      return;
    }
    setError(null);
    try {
      await archiveUnit.mutateAsync();
      router.push('/app/portfolio/units');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to archive unit.');
    }
  }

  async function onStatusSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await updateStatus.mutateAsync({
        body: { status, reason },
        version: unit.version,
      });
      setSuccess('Operational status updated.');
      setReason('');
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to update operational status.',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {unit.code} — {unit.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            {unit.operationalStatus} · {unit.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate ? (
            <Link
              href={`/app/portfolio/units/${unitId}/edit`}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Edit
            </Link>
          ) : null}
          <Link
            href={`/app/portfolio/units/${unitId}/beds`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Beds
          </Link>
          <Link
            href={`/app/portfolio/properties/${unit.propertyId}`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Property
          </Link>
          {canArchive && unit.status !== 'ARCHIVED' ? (
            <Button
              variant="destructive"
              onClick={() => void onArchive()}
              disabled={archiveUnit.isPending}
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
      {success ? (
        <p className="text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}

      <dl className="grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Unit type</dt>
          <dd>{unit.unitType}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Allocation mode</dt>
          <dd>{unit.allocationMode}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Capacity</dt>
          <dd>{unit.capacity}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Version</dt>
          <dd>{unit.version}</dd>
        </div>
      </dl>

      {canUpdate ? (
        <form className="max-w-md space-y-3" onSubmit={(event) => void onStatusSubmit(event)}>
          <h3 className="text-sm font-semibold">Update operational status</h3>
          <div className="space-y-1">
            <Label htmlFor="operationalStatus">Status</Label>
            <select
              id="operationalStatus"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(event) => setStatus(event.target.value as InventoryOperationalStatus)}
            >
              {OPERATIONAL_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="statusReason">Reason (required)</Label>
            <Input
              id="statusReason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={updateStatus.isPending || !reason.trim()}>
            {updateStatus.isPending ? 'Updating…' : 'Update status'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
