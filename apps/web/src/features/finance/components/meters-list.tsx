'use client';

import { useMemo, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useBulkMeterReadings, useMeters } from '../hooks/use-meters';
import { METERS_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

type ReadingRow = {
  meterId: string;
  value: string;
};

export function MetersList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const metersQuery = useMeters({
    propertyId: propertyScope === 'ALL' ? undefined : propertyScope,
  });
  const bulkMutation = useBulkMeterReadings();

  const canList = hasPermission(meQuery.data, METERS_PERMISSIONS.list);
  const canBulk = canMutate(meQuery.data, METERS_PERMISSIONS.readingsBulk);

  const meters = metersQuery.data?.data ?? [];
  const [readAt, setReadAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [rows, setRows] = useState<ReadingRow[]>([]);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  const rowMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.meterId, row.value);
    }
    return map;
  }, [rows]);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canList) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list meters.
      </p>
    );
  }

  if (metersQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading meters…</p>;
  }

  if (metersQuery.isError) {
    const message =
      metersQuery.error instanceof AuthApiError
        ? metersQuery.error.message
        : 'Unable to load meters.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  function setMeterValue(meterId: string, value: string): void {
    setRows((prev) => {
      const next = prev.filter((row) => row.meterId !== meterId);
      if (value.trim() !== '') {
        next.push({ meterId, value: value.trim() });
      }
      return next;
    });
  }

  async function onSubmitReadings(): Promise<void> {
    setBulkError(null);
    setBulkSuccess(null);
    const items = rows
      .filter((row) => row.value.trim() !== '')
      .map((row, index) => ({
        clientItemId: `row-${index}`,
        meterId: row.meterId,
        readAt: new Date(readAt).toISOString(),
        value: row.value.trim(),
        source: 'STAFF_GRID',
      }));
    if (items.length === 0) {
      setBulkError('Enter at least one reading value.');
      return;
    }
    try {
      await bulkMutation.mutateAsync({ body: { items, mode: 'PARTIAL' } });
      setBulkSuccess(`Submitted ${items.length} reading(s).`);
      setRows([]);
    } catch (error) {
      setBulkError(error instanceof AuthApiError ? error.message : 'Bulk submit failed.');
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-xs">
        MVP meter grid: enter current readings for active meters in Property scope.
      </p>

      {meters.length === 0 ? (
        <p className="text-muted-foreground text-sm">No meters in scope.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Serial</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Reading</th>
              </tr>
            </thead>
            <tbody>
              {meters.map((meter) => (
                <tr key={meter.id} className="border-border border-b">
                  <td className="px-2 py-2">{meter.serialNumber}</td>
                  <td className="px-2 py-2">{meter.meterType}</td>
                  <td className="px-2 py-2">{meter.status}</td>
                  <td className="px-2 py-2">
                    <Label htmlFor={`reading-${meter.id}`} className="sr-only">
                      Reading for {meter.serialNumber}
                    </Label>
                    <Input
                      id={`reading-${meter.id}`}
                      value={rowMap.get(meter.id) ?? ''}
                      onChange={(event) => setMeterValue(meter.id, event.target.value)}
                      className="w-32"
                      disabled={!canBulk}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canBulk && meters.length > 0 ? (
        <div className="space-y-2">
          <Label htmlFor="read-at">Read at</Label>
          <Input
            id="read-at"
            type="datetime-local"
            value={readAt}
            onChange={(event) => setReadAt(event.target.value)}
            className="max-w-xs"
          />
          <Button
            type="button"
            onClick={() => void onSubmitReadings()}
            disabled={bulkMutation.isPending}
          >
            Submit readings
          </Button>
        </div>
      ) : null}

      {bulkSuccess ? (
        <p className="text-sm text-green-700" role="status">
          {bulkSuccess}
        </p>
      ) : null}
      {bulkError ? (
        <p className="text-sm text-red-600" role="alert">
          {bulkError}
        </p>
      ) : null}
    </div>
  );
}
