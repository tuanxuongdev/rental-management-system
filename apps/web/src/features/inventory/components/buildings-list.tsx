'use client';

import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useBuildings, useCreateBuilding } from '../hooks/use-buildings';
import { useProperty } from '../hooks/use-properties';
import { PORTFOLIO_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function BuildingsList({ propertyId }: { propertyId: string }): React.JSX.Element {
  const meQuery = useMe();
  const propertyQuery = useProperty(propertyId);
  const buildingsQuery = useBuildings(propertyId);
  const createBuilding = useCreateBuilding(propertyId);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesView);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesUpdate);

  if (meQuery.isLoading || buildingsQuery.isLoading || propertyQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading buildings…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view buildings.
      </p>
    );
  }

  if (buildingsQuery.isError) {
    const message =
      buildingsQuery.error instanceof AuthApiError
        ? buildingsQuery.error.message
        : 'Unable to load buildings.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const buildings = buildingsQuery.data?.data ?? [];

  async function onCreate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await createBuilding.mutateAsync({ code, name });
      setCode('');
      setName('');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to create building.');
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Buildings for {propertyQuery.data?.code ?? propertyId}
      </p>

      {canCreate ? (
        <form
          className="flex max-w-xl flex-wrap items-end gap-3"
          onSubmit={(event) => void onCreate(event)}
        >
          <div className="space-y-1">
            <Label htmlFor="buildingCode">Code</Label>
            <Input
              id="buildingCode"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="buildingName">Name</Label>
            <Input
              id="buildingName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={createBuilding.isPending}>
            Add building
          </Button>
        </form>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {buildings.length === 0 ? (
        <p className="text-muted-foreground text-sm">No buildings yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Code</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Sort</th>
              </tr>
            </thead>
            <tbody>
              {buildings.map((building) => (
                <tr key={building.id} className="border-border border-b">
                  <td className="px-2 py-2">{building.code}</td>
                  <td className="px-2 py-2">{building.name}</td>
                  <td className="px-2 py-2">{building.status}</td>
                  <td className="px-2 py-2">{building.sortOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
