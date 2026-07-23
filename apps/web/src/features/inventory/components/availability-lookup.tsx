'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { AvailabilityQuery } from '@rpm/contracts';
import { Button, Label } from '@rpm/ui';

type UnitTypeKind = NonNullable<AvailabilityQuery['unitType']>;
type AllocationMode = NonNullable<AvailabilityQuery['allocationMode']>;

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useAvailability } from '../hooks/use-availability';
import { useProperties } from '../hooks/use-properties';
import { PORTFOLIO_PERMISSIONS, hasPermission } from '../utils/permissions';

const UNIT_TYPES: Array<UnitTypeKind | ''> = [
  '',
  'APARTMENT',
  'STUDIO',
  'PRIVATE_ROOM',
  'SHARED_ROOM',
];
const ALLOCATION_MODES: Array<AllocationMode | ''> = ['', 'WHOLE_UNIT', 'BED', 'CAPACITY'];

export function AvailabilityLookup(): React.JSX.Element {
  const meQuery = useMe();
  const propertiesQuery = useProperties();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [propertyId, setPropertyId] = useState(propertyScope !== 'ALL' ? propertyScope : '');
  const [unitType, setUnitType] = useState<UnitTypeKind | ''>('');
  const [allocationMode, setAllocationMode] = useState<AllocationMode | ''>('');
  const [submitted, setSubmitted] = useState<AvailabilityQuery | null>(null);

  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.occupancyView);
  const availabilityQuery = useAvailability(submitted);

  const properties = propertiesQuery.data?.data ?? [];

  const queryPreview = useMemo(() => {
    if (!propertyId) {
      return null;
    }
    const query: AvailabilityQuery = { propertyId };
    if (unitType) {
      query.unitType = unitType;
    }
    if (allocationMode) {
      query.allocationMode = allocationMode;
    }
    return query;
  }, [propertyId, unitType, allocationMode]);

  if (meQuery.isLoading || propertiesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading availability…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view occupancy/availability.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <form
        className="flex max-w-3xl flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (queryPreview) {
            setSubmitted(queryPreview);
          }
        }}
      >
        <div className="space-y-1">
          <Label htmlFor="availabilityProperty">Property (required)</Label>
          <select
            id="availabilityProperty"
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
            value={propertyId}
            onChange={(event) => setPropertyId(event.target.value)}
            required
          >
            <option value="">Select property…</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.code} — {property.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="availabilityUnitType">Unit type</Label>
          <select
            id="availabilityUnitType"
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
            value={unitType}
            onChange={(event) => setUnitType(event.target.value as UnitTypeKind | '')}
          >
            {UNIT_TYPES.map((type) => (
              <option key={type || 'any'} value={type}>
                {type || 'Any'}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="availabilityAllocation">Allocation</Label>
          <select
            id="availabilityAllocation"
            className="border-input bg-background rounded-md border px-2 py-1.5 text-sm"
            value={allocationMode}
            onChange={(event) => setAllocationMode(event.target.value as AllocationMode | '')}
          >
            {ALLOCATION_MODES.map((mode) => (
              <option key={mode || 'any'} value={mode}>
                {mode || 'Any'}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={!propertyId}>
          Look up
        </Button>
      </form>

      {!submitted ? (
        <p className="text-muted-foreground text-sm">Choose a property and look up availability.</p>
      ) : availabilityQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Searching…</p>
      ) : availabilityQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          {availabilityQuery.error instanceof AuthApiError
            ? availabilityQuery.error.message
            : 'Unable to load availability.'}
        </p>
      ) : (availabilityQuery.data?.data ?? []).length === 0 ? (
        <p className="text-muted-foreground text-sm">No available inventory for these filters.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Code</th>
                <th className="px-2 py-2 font-medium">Granularity</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">As of</th>
                <th className="px-2 py-2 font-medium">Unit</th>
              </tr>
            </thead>
            <tbody>
              {(availabilityQuery.data?.data ?? []).map((row) => (
                <tr key={`${row.unitId}-${row.bedId ?? 'unit'}`} className="border-border border-b">
                  <td className="px-2 py-2">{row.code}</td>
                  <td className="px-2 py-2">{row.granularity}</td>
                  <td className="px-2 py-2">{row.operationalStatus}</td>
                  <td className="px-2 py-2">{row.asOf}</td>
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/portfolio/units/${row.unitId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      Open
                    </Link>
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
