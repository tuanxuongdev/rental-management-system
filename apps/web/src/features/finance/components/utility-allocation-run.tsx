'use client';

import { useState } from 'react';

import { UTILITIES_ALLOCATION_ENABLED } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { commitUtilityAllocationRun, previewUtilityAllocation } from '@/lib/billing-api';
import { useAuthStore } from '@/state/auth-store';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { formatMoney } from '../utils/format-money';
import { UTILITIES_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function UtilityAllocationRun(): React.JSX.Element | null {
  if (!UTILITIES_ALLOCATION_ENABLED) {
    return null;
  }

  return <UtilityAllocationRunInner />;
}

function UtilityAllocationRunInner(): React.JSX.Element {
  const meQuery = useMe();
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);

  const canAllocate = canMutate(meQuery.data, UTILITIES_PERMISSIONS.allocate);
  const canView = hasPermission(meQuery.data, UTILITIES_PERMISSIONS.allocate);

  const [servicePeriod, setServicePeriod] = useState(() => {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [utilityType, setUtilityType] = useState<'ELECTRICITY' | 'WATER'>('ELECTRICITY');
  const [tariffId, setTariffId] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [previewTotal, setPreviewTotal] = useState<string | null>(null);
  const [previewCurrency, setPreviewCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commitConfirmed, setCommitConfirmed] = useState(false);
  const [pending, setPending] = useState(false);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to run utility allocation.
      </p>
    );
  }

  if (propertyScope === 'ALL') {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Select a Property scope before running utility allocation.
      </p>
    );
  }

  async function onPreview(): Promise<void> {
    setError(null);
    setCommitConfirmed(false);
    if (!accessToken || !organizationId || !tariffId.trim()) {
      setError('Tariff ID is required for preview.');
      return;
    }
    setPending(true);
    try {
      const result = await previewUtilityAllocation(accessToken, organizationId, {
        propertyId: propertyScope,
        utilityType,
        servicePeriod: servicePeriod.trim(),
        method: 'EQUAL_SHARE',
        tariffId: tariffId.trim(),
      });
      setRunId(result.id);
      setPreviewTotal(result.totalAllocatedAmount);
      setPreviewCurrency(result.currency);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Preview failed.');
    } finally {
      setPending(false);
    }
  }

  async function onCommit(): Promise<void> {
    if (!runId || !commitConfirmed || !accessToken || !organizationId) {
      return;
    }
    setError(null);
    setPending(true);
    try {
      await commitUtilityAllocationRun(accessToken, organizationId, runId, {}, crypto.randomUUID());
      setCommitConfirmed(false);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Commit failed.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        Thin MVP: equal-share allocation preview and commit for the active Property.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="utility-period">Service period (YYYY-MM)</Label>
          <Input
            id="utility-period"
            value={servicePeriod}
            onChange={(event) => setServicePeriod(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="utility-type">Utility type</Label>
          <select
            id="utility-type"
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
            value={utilityType}
            onChange={(event) => setUtilityType(event.target.value as 'ELECTRICITY' | 'WATER')}
          >
            <option value="ELECTRICITY">Electricity</option>
            <option value="WATER">Water</option>
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="tariff-id">Tariff ID</Label>
          <Input
            id="tariff-id"
            value={tariffId}
            onChange={(event) => setTariffId(event.target.value)}
            placeholder="UUID from tariffs catalog"
          />
        </div>
      </div>
      <Button type="button" onClick={() => void onPreview()} disabled={pending || !canAllocate}>
        Preview allocation
      </Button>
      {previewTotal && previewCurrency ? (
        <p className="text-sm">
          Preview total {formatMoney(previewTotal, previewCurrency)}
          {runId ? ` · run ${runId.slice(0, 8)}` : ''}
        </p>
      ) : null}
      {canAllocate && runId ? (
        <div className="space-y-2 border-t pt-4">
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={commitConfirmed}
              onChange={(event) => setCommitConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>I confirm utility allocation should be committed for this preview.</span>
          </label>
          <Button
            type="button"
            onClick={() => void onCommit()}
            disabled={!commitConfirmed || pending}
          >
            Commit allocation
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
