'use client';

import { useEffect, useMemo, useState } from 'react';

import type { BillingRunPreviewResponse } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { useMe, useOrganizationSettings } from '@/features/admin';
import { useProperties } from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import {
  useApproveBillingRun,
  useBillingRun,
  useBillingRuns,
  useCommitBillingRun,
  useCreateBillingRun,
  usePreviewBillingRunMutation,
} from '../hooks/use-billing-runs';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

function defaultPeriodKey(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '2026';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
}

function periodBoundsInZone(
  periodKey: string,
  timeZone: string,
): { periodStart: string; periodEnd: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return null;
  }
  const periodStart = `${match[1]}-${match[2]}-01`;
  // Last calendar day of month (timezone label is for display; dates are YYYY-MM-DD).
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const periodEnd = `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`;
  void timeZone;
  return { periodStart, periodEnd };
}

export function BillingRunWorkspace(): React.JSX.Element {
  const meQuery = useMe();
  const settingsQuery = useOrganizationSettings();
  const propertiesQuery = useProperties();
  const canPreview = hasPermission(meQuery.data, FINANCE_PERMISSIONS.billingRunPreview);
  const canCommit = canMutate(meQuery.data, FINANCE_PERMISSIONS.billingRunCommit);

  const runsQuery = useBillingRuns();
  const createRun = useCreateBillingRun();
  const previewMutation = usePreviewBillingRunMutation();

  const orgTimeZone = settingsQuery.data?.timeZone;
  const usingUtcFallback = orgTimeZone === undefined;

  const [periodKey, setPeriodKey] = useState(() => defaultPeriodKey('UTC'));
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [commitConfirmed, setCommitConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BillingRunPreviewResponse | null>(null);

  const runQuery = useBillingRun(selectedRunId);
  const approveMutation = useApproveBillingRun(selectedRunId ?? '');
  const commitMutation = useCommitBillingRun(selectedRunId ?? '');

  const runs = runsQuery.data?.data ?? [];
  const activeRun = runQuery.data;

  const propertyTimeZone = useMemo(() => {
    if (!activeRun?.propertyId || !propertiesQuery.data?.data) {
      return null;
    }
    return (
      propertiesQuery.data.data.find((property) => property.id === activeRun.propertyId)
        ?.timeZone ?? null
    );
  }, [activeRun?.propertyId, propertiesQuery.data?.data]);

  const effectiveTimeZone = propertyTimeZone ?? orgTimeZone ?? 'UTC';
  const timeZoneLabel =
    propertyTimeZone !== null
      ? propertyTimeZone
      : orgTimeZone !== undefined
        ? orgTimeZone
        : 'UTC (fallback)';

  useEffect(() => {
    if (orgTimeZone !== undefined) {
      setPeriodKey((current) => {
        // Only seed once from UTC default when org TZ arrives.
        if (current === defaultPeriodKey('UTC')) {
          return defaultPeriodKey(orgTimeZone);
        }
        return current;
      });
    }
  }, [orgTimeZone]);

  useEffect(() => {
    if (!selectedRunId && runs.length > 0) {
      setSelectedRunId(runs[0]?.id ?? null);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    setPreview(null);
    setCommitConfirmed(false);
  }, [selectedRunId]);

  const periodBounds = useMemo(
    () => periodBoundsInZone(periodKey, effectiveTimeZone),
    [periodKey, effectiveTimeZone],
  );

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canPreview) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to preview billing runs.
      </p>
    );
  }

  async function onCreateRun(): Promise<void> {
    setFormError(null);
    setActionError(null);
    if (!periodBounds) {
      setFormError(`Period must be YYYY-MM (${timeZoneLabel}).`);
      return;
    }
    try {
      const created = await createRun.mutateAsync({
        body: {
          periodKey: periodKey.trim(),
          timeZone: effectiveTimeZone,
          periodStart: periodBounds.periodStart,
          periodEnd: periodBounds.periodEnd,
        },
      });
      setSelectedRunId(created.id);
      setPreview(null);
      await runsQuery.refetch();
    } catch (error) {
      setFormError(error instanceof AuthApiError ? error.message : 'Unable to create billing run.');
    }
  }

  async function onPreview(): Promise<void> {
    if (!selectedRunId || !activeRun) {
      return;
    }
    setActionError(null);
    try {
      const result = await previewMutation.mutateAsync({
        billingRunId: selectedRunId,
        body: { refresh: true },
        version: activeRun.version,
      });
      setPreview(result);
      await runQuery.refetch();
    } catch (error) {
      setActionError(error instanceof AuthApiError ? error.message : 'Unable to preview.');
    }
  }

  async function onApprove(): Promise<void> {
    if (!activeRun || activeRun.status !== 'PREVIEWED' || !canCommit) {
      return;
    }
    setActionError(null);
    try {
      await approveMutation.mutateAsync({ body: {}, version: activeRun.version });
      await runQuery.refetch();
    } catch (error) {
      setActionError(error instanceof AuthApiError ? error.message : 'Approve failed.');
    }
  }

  async function onCommit(): Promise<void> {
    if (!activeRun || !commitConfirmed || activeRun.status !== 'APPROVED' || !canCommit) {
      return;
    }
    setActionError(null);
    try {
      await commitMutation.mutateAsync({ body: {}, version: activeRun.version });
      setCommitConfirmed(false);
      await runQuery.refetch();
      await runsQuery.refetch();
    } catch (error) {
      setActionError(error instanceof AuthApiError ? error.message : 'Commit failed.');
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-xs">
        Create a run for periodKey (YYYY-MM) in {timeZoneLabel}
        {usingUtcFallback && orgTimeZone === undefined ? ' until organization timezone loads' : ''},
        preview charges, approve when previewed, then commit once confirmed.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="billing-period">Period (YYYY-MM, {timeZoneLabel})</Label>
          <Input
            id="billing-period"
            value={periodKey}
            onChange={(event) => setPeriodKey(event.target.value)}
            className="w-40"
          />
        </div>
        <Button type="button" onClick={() => void onCreateRun()} disabled={createRun.isPending}>
          Create run
        </Button>
      </div>
      {formError ? (
        <p className="text-sm text-red-600" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="space-y-1">
        <Label htmlFor="billing-run-select">Billing runs</Label>
        <select
          id="billing-run-select"
          className="border-input bg-background h-10 max-w-md rounded-md border px-3 text-sm"
          value={selectedRunId ?? ''}
          onChange={(event) => {
            setSelectedRunId(event.target.value || null);
          }}
        >
          <option value="">Select a run</option>
          {runs.map((run) => (
            <option key={run.id} value={run.id}>
              {run.periodKey} · {run.status}
            </option>
          ))}
        </select>
      </div>

      {runsQuery.isError ? (
        <p className="text-sm text-red-600" role="alert">
          Unable to load billing runs.
        </p>
      ) : null}

      {activeRun ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{activeRun.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Period</dt>
            <dd>
              {activeRun.periodStart} – {activeRun.periodEnd} ({activeRun.timeZone})
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Preview total</dt>
            <dd>
              {activeRun.currency && activeRun.totalsAmount
                ? formatMoney(activeRun.totalsAmount, activeRun.currency)
                : '—'}
            </dd>
          </div>
        </dl>
      ) : null}

      {selectedRunId && activeRun ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void onPreview()}
            disabled={previewMutation.isPending}
          >
            Preview
          </Button>
          {canCommit && activeRun.status === 'PREVIEWED' ? (
            <Button
              type="button"
              onClick={() => void onApprove()}
              disabled={approveMutation.isPending}
            >
              Approve run
            </Button>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Preview</h2>
          <p className="text-muted-foreground text-xs">
            {preview.lineCount} lines · generated {new Date(preview.generatedAt).toLocaleString()}
            {preview.priorPeriodTotalsAmount && preview.currency
              ? ` · prior period ${formatMoney(preview.priorPeriodTotalsAmount, preview.currency)}`
              : ''}
          </p>
          {preview.totalsAmount && preview.currency ? (
            <p className="text-sm font-medium">
              Total {formatMoney(preview.totalsAmount, preview.currency)}
            </p>
          ) : null}
          {preview.sampleLines.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="px-2 py-2 font-medium">Lease</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleLines.map((line) => (
                    <tr
                      key={`${line.leaseId}-${line.chargeKey}`}
                      className="border-border border-b"
                    >
                      <td className="px-2 py-2">{line.leaseNumber ?? line.leaseId.slice(0, 8)}</td>
                      <td className="px-2 py-2">{line.description}</td>
                      <td className="px-2 py-2">{formatMoney(line.amount, line.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No sample lines in preview.</p>
          )}
        </section>
      ) : null}

      {canCommit && activeRun && activeRun.status === 'APPROVED' ? (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium" role="alert">
            Committing posts invoices and ledger entries for this period. This action is high risk.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={commitConfirmed}
              onChange={(event) => setCommitConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>I confirm this billing run should be committed for {activeRun.periodKey}.</span>
          </label>
          <Button
            type="button"
            onClick={() => void onCommit()}
            disabled={!commitConfirmed || commitMutation.isPending}
          >
            Commit billing run
          </Button>
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
