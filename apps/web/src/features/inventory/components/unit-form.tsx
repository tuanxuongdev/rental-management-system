'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { CreateUnitRequest } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

type UnitTypeKind = CreateUnitRequest['unitType'];
type AllocationMode = CreateUnitRequest['allocationMode'];

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useProperties } from '../hooks/use-properties';
import { useCreateUnit, usePatchUnit, useUnit } from '../hooks/use-units';
import { PORTFOLIO_PERMISSIONS, canMutate } from '../utils/permissions';

const UNIT_TYPES: UnitTypeKind[] = ['APARTMENT', 'STUDIO', 'PRIVATE_ROOM', 'SHARED_ROOM'];
const ALLOCATION_MODES: AllocationMode[] = ['WHOLE_UNIT', 'BED', 'CAPACITY'];

type UnitFormProps = {
  mode: 'create' | 'edit';
  unitId?: string;
};

export function UnitForm({ mode, unitId }: UnitFormProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meQuery = useMe();
  const propertiesQuery = useProperties();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const unitQuery = useUnit(unitId ?? '');

  const queryPropertyId = searchParams.get('propertyId') ?? '';
  const initialPropertyId = queryPropertyId || (propertyScope !== 'ALL' ? propertyScope : '');

  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [unitType, setUnitType] = useState<UnitTypeKind>('APARTMENT');
  const [allocationMode, setAllocationMode] = useState<AllocationMode>('WHOLE_UNIT');
  const [capacity, setCapacity] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const createUnit = useCreateUnit(propertyId);
  const patchUnit = usePatchUnit(unitId ?? '');

  const isEdit = mode === 'edit';
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.unitsCreate);
  const canUpdate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.unitsUpdate);
  const canSubmit = isEdit ? canUpdate : canCreate;

  useEffect(() => {
    if (isEdit && unitQuery.data) {
      const unit = unitQuery.data;
      setPropertyId(unit.propertyId);
      setCode(unit.code);
      setName(unit.name);
      setUnitType(unit.unitType);
      setAllocationMode(unit.allocationMode);
      setCapacity(String(unit.capacity));
    }
  }, [isEdit, unitQuery.data]);

  if (meQuery.isLoading || propertiesQuery.isLoading || (isEdit && unitQuery.isLoading)) {
    return <p className="text-muted-foreground text-sm">Loading unit form…</p>;
  }

  if (!canSubmit) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to {isEdit ? 'update' : 'create'} units.
      </p>
    );
  }

  if (isEdit && (unitQuery.isError || !unitQuery.data)) {
    const message =
      unitQuery.error instanceof AuthApiError ? unitQuery.error.message : 'Unit not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    if (!propertyId) {
      setError('Select a property.');
      return;
    }

    const body: CreateUnitRequest = {
      code,
      name,
      unitType,
      allocationMode,
      capacity: Number(capacity) || 1,
    };

    try {
      if (isEdit && unitId && unitQuery.data) {
        await patchUnit.mutateAsync({ body, version: unitQuery.data.version });
        router.push(`/app/portfolio/units/${unitId}`);
        return;
      }
      const created = await createUnit.mutateAsync(body);
      router.push(`/app/portfolio/units/${created.id}`);
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to save unit.');
    }
  }

  const pending = createUnit.isPending || patchUnit.isPending;
  const properties = propertiesQuery.data?.data ?? [];

  return (
    <form
      className="mx-auto max-w-lg space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="propertyId">Property (required)</Label>
        <select
          id="propertyId"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          disabled={isEdit}
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
      <div className="space-y-2">
        <Label htmlFor="code">Code (required)</Label>
        <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name (required)</Label>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="unitType">Unit type (required)</Label>
        <select
          id="unitType"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={unitType}
          onChange={(event) => setUnitType(event.target.value as UnitTypeKind)}
        >
          {UNIT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="allocationMode">Allocation mode (required)</Label>
        <select
          id="allocationMode"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={allocationMode}
          onChange={(event) => setAllocationMode(event.target.value as AllocationMode)}
        >
          {ALLOCATION_MODES.map((modeOption) => (
            <option key={modeOption} value={modeOption}>
              {modeOption}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="capacity">Capacity (required)</Label>
        <Input
          id="capacity"
          type="number"
          min={1}
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create unit'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              isEdit && unitId ? `/app/portfolio/units/${unitId}` : '/app/portfolio/units',
            )
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
