'use client';

import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useAccountingPeriods, useClosePeriod } from '../hooks/use-reconciliation';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function PeriodsWorkspace(): React.JSX.Element {
  const meQuery = useMe();
  const periodsQuery = useAccountingPeriods();
  const closeMutation = useClosePeriod();
  const canClose = canMutate(meQuery.data, FINANCE_PERMISSIONS.periodClose);
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.reconciliationView);
  const [periodKey, setPeriodKey] = useState(() => new Date().toISOString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view accounting periods.
      </p>
    );
  }

  async function onClose(): Promise<void> {
    setError(null);
    try {
      await closeMutation.mutateAsync({ periodKey });
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Unable to close period.');
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Accounting periods</h1>
      {canClose ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="periodKey">Period (YYYY-MM)</Label>
            <Input
              id="periodKey"
              value={periodKey}
              onChange={(e) => setPeriodKey(e.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void onClose()}>
            Close period
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2 text-sm">
        {(periodsQuery.data?.data ?? []).map((period) => (
          <li key={period.id}>
            {period.periodKey} · {period.status}
            {period.closedAt ? ` · closed ${period.closedAt}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
