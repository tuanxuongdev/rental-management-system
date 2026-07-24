'use client';

import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useFinanceExport } from '../hooks/use-reconciliation';
import { FINANCE_PERMISSIONS, canMutate } from '../utils/permissions';

export function FinanceExportsWorkspace(): React.JSX.Element {
  const meQuery = useMe();
  const exportMutation = useFinanceExport();
  const canExport = canMutate(meQuery.data, FINANCE_PERMISSIONS.exportsCreate);
  const [type, setType] = useState<'aging' | 'payments'>('aging');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);

  if (!canExport) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to export finance data.
      </p>
    );
  }

  async function onExport(): Promise<void> {
    setError(null);
    try {
      const result = await exportMutation.mutateAsync({
        type,
        asOf,
        currency,
        format: 'CSV',
      });
      const content = result.csv ?? JSON.stringify(result.rows, null, 2);
      const isCsv = typeof result.csv === 'string' && result.csv.length > 0;
      const blob = new Blob([content], {
        type: isCsv ? 'text/csv' : 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `finance-${type}-${asOf}.${isCsv ? 'csv' : 'json'}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Export failed.');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Finance exports</h1>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="type">Type</Label>
          <select
            id="type"
            className="border-border block rounded-md border px-2 py-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as 'aging' | 'payments')}
          >
            <option value="aging">Aging</option>
            <option value="payments">Payments</option>
          </select>
        </div>
        <div>
          <Label htmlFor="asOf">As of</Label>
          <Input id="asOf" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
          />
        </div>
        <Button type="button" onClick={() => void onExport()}>
          Download CSV
        </Button>
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
