'use client';

import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useBeds, useCreateBed } from '../hooks/use-beds';
import { useUnit } from '../hooks/use-units';
import { PORTFOLIO_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function BedsList({ unitId }: { unitId: string }): React.JSX.Element {
  const meQuery = useMe();
  const unitQuery = useUnit(unitId);
  const bedsQuery = useBeds(unitId);
  const createBed = useCreateBed(unitId);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.bedsList);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.bedsCreate);

  if (meQuery.isLoading || bedsQuery.isLoading || unitQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading beds…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list beds.
      </p>
    );
  }

  if (bedsQuery.isError) {
    const message =
      bedsQuery.error instanceof AuthApiError ? bedsQuery.error.message : 'Unable to load beds.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const beds = bedsQuery.data?.data ?? [];

  async function onCreate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await createBed.mutateAsync({ code, label });
      setCode('');
      setLabel('');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to create bed.');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Beds for unit {unitQuery.data?.code ?? unitId}
        {unitQuery.data?.allocationMode === 'WHOLE_UNIT'
          ? ' (optional — typically used for shared allocation modes)'
          : ''}
      </p>

      {canCreate ? (
        <form
          className="flex max-w-xl flex-wrap items-end gap-3"
          onSubmit={(event) => void onCreate(event)}
        >
          <div className="space-y-1">
            <Label htmlFor="bedCode">Code</Label>
            <Input
              id="bedCode"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bedLabel">Label</Label>
            <Input
              id="bedLabel"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={createBed.isPending}>
            Add bed
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {beds.length === 0 ? (
        <p className="text-muted-foreground text-sm">No beds yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Code</th>
                <th className="px-2 py-2 font-medium">Label</th>
                <th className="px-2 py-2 font-medium">Operational</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {beds.map((bed) => (
                <tr key={bed.id} className="border-border border-b">
                  <td className="px-2 py-2">{bed.code}</td>
                  <td className="px-2 py-2">{bed.label}</td>
                  <td className="px-2 py-2">{bed.operationalStatus}</td>
                  <td className="px-2 py-2">{bed.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
