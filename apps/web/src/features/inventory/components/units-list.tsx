'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Button } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { BulkStatusBar, UnitsExportButton } from '@/features/imports';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useProperties } from '../hooks/use-properties';
import { useUnits } from '../hooks/use-units';
import { PORTFOLIO_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

export function UnitsList(): React.JSX.Element {
  const meQuery = useMe();
  const unitsQuery = useUnits();
  const propertiesQuery = useProperties();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.unitsList);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.unitsCreate);
  const canBulkUpdate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.unitsUpdate);

  const units = useMemo(
    () => unitsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [unitsQuery.data?.pages],
  );

  if (meQuery.isLoading || unitsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading units…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list units.
      </p>
    );
  }

  if (unitsQuery.isError) {
    const message =
      unitsQuery.error instanceof AuthApiError ? unitsQuery.error.message : 'Unable to load units.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const propertyNames = new Map(
    (propertiesQuery.data?.data ?? []).map((property) => [property.id, property.name]),
  );
  const createHref =
    propertyScope !== 'ALL'
      ? `/app/portfolio/units/new?propertyId=${propertyScope}`
      : '/app/portfolio/units/new';

  const allVisibleSelected =
    units.length > 0 && units.every((unit) => selectedUnitIds.includes(unit.id));

  function toggleUnit(unitId: string): void {
    setSelectedUnitIds((current) =>
      current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId],
    );
  }

  function toggleAllVisible(): void {
    if (allVisibleSelected) {
      setSelectedUnitIds([]);
      return;
    }
    setSelectedUnitIds(units.map((unit) => unit.id));
  }

  const emptyMessage =
    propertyScope !== 'ALL' ? 'No units in the selected property scope.' : 'No units yet.';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3">
        {canCreate ? (
          <Link href={createHref} className={primaryLinkClass}>
            Create unit
          </Link>
        ) : null}
        <UnitsExportButton />
      </div>

      {canBulkUpdate ? (
        <BulkStatusBar
          selectedUnitIds={selectedUnitIds}
          onClearSelection={() => setSelectedUnitIds([])}
        />
      ) : null}

      {units.length === 0 ? (
        <p className="text-muted-foreground text-sm">{emptyMessage}</p>
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-border border-b">
                  {canBulkUpdate ? (
                    <th className="px-2 py-2 font-medium">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        aria-label="Select all visible units"
                      />
                    </th>
                  ) : null}
                  <th className="px-2 py-2 font-medium">Code</th>
                  <th className="px-2 py-2 font-medium">Name</th>
                  <th className="px-2 py-2 font-medium">Property</th>
                  <th className="px-2 py-2 font-medium">Type</th>
                  <th className="px-2 py-2 font-medium">Allocation</th>
                  <th className="px-2 py-2 font-medium">Capacity</th>
                  <th className="px-2 py-2 font-medium">Operational</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr key={unit.id} className="border-border border-b">
                    {canBulkUpdate ? (
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedUnitIds.includes(unit.id)}
                          onChange={() => toggleUnit(unit.id)}
                          aria-label={`Select unit ${unit.code}`}
                        />
                      </td>
                    ) : null}
                    <td className="px-2 py-2">
                      <Link
                        href={`/app/portfolio/units/${unit.id}`}
                        className="text-foreground underline-offset-4 hover:underline"
                      >
                        {unit.code}
                      </Link>
                    </td>
                    <td className="px-2 py-2">{unit.name}</td>
                    <td className="px-2 py-2">
                      {propertyNames.get(unit.propertyId) ?? unit.propertyId.slice(0, 8)}
                    </td>
                    <td className="px-2 py-2">{unit.unitType}</td>
                    <td className="px-2 py-2">{unit.allocationMode}</td>
                    <td className="px-2 py-2">{unit.capacity}</td>
                    <td className="px-2 py-2">{unit.operationalStatus}</td>
                    <td className="px-2 py-2">{unit.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unitsQuery.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              disabled={unitsQuery.isFetchingNextPage}
              onClick={() => void unitsQuery.fetchNextPage()}
            >
              {unitsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
