'use client';

import { useState } from 'react';

import { Button } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useCreateExport } from '../hooks/use-export';
import { IMPORT_PERMISSIONS, canMutate } from '../utils/permissions';

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function UnitsExportButton(): React.JSX.Element | null {
  const meQuery = useMe();
  const createExportMutation = useCreateExport();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const [error, setError] = useState<string | null>(null);
  const canExport = canMutate(meQuery.data, IMPORT_PERMISSIONS.exportsInventory);

  if (!canExport) {
    return null;
  }

  async function onExport(): Promise<void> {
    setError(null);
    try {
      const job = await createExportMutation.mutateAsync({
        type: 'INVENTORY',
        sync: true,
        ...(propertyScope !== 'ALL' ? { propertyId: propertyScope } : {}),
      });
      if (job.csvText) {
        downloadText(`inventory-export-${job.id}.csv`, job.csvText);
        if (job.truncated) {
          setError(
            `Export truncated at ${job.counts.total} rows (max page). Narrow property scope or raise filters.`,
          );
        }
        return;
      }
      setError(
        `Export job ${job.status}. CSV is not inline; check Operations for job ${job.id}.`,
      );
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to export inventory.');
    }
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        disabled={createExportMutation.isPending}
        onClick={() => void onExport()}
      >
        {createExportMutation.isPending ? 'Exporting…' : 'Export CSV'}
      </Button>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
