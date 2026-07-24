'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import {
  useCompleteReconRun,
  useCreateReconciliationRun,
  useIngestSettlements,
  useReconciliationItems,
  useReconciliationRun,
  useReconciliationRuns,
  useResolveReconItem,
} from '../hooks/use-reconciliation';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function ReconciliationWorkspace(): React.JSX.Element {
  const meQuery = useMe();
  const runsQuery = useReconciliationRuns();
  const createMutation = useCreateReconciliationRun();
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.reconciliationView);
  const canPerform = canMutate(meQuery.data, FINANCE_PERMISSIONS.reconciliationPerform);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState('2026-07-01');
  const [periodEnd, setPeriodEnd] = useState('2026-07-31');
  const [currency, setCurrency] = useState('USD');
  const [controlTotal, setControlTotal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view reconciliation.
      </p>
    );
  }

  async function onCreate(): Promise<void> {
    setError(null);
    try {
      const run = await createMutation.mutateAsync({
        idempotencyKey: idemKey,
        body: {
          sourceType: 'PROVIDER',
          periodStart,
          periodEnd,
          currency,
          controlTotal: controlTotal.trim() || undefined,
        },
      });
      setSelectedRunId(run.id);
      setIdemKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Unable to create run.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reconciliation</h1>
        <p className="text-muted-foreground text-sm">
          Match provider settlements to internal payments and resolve exceptions.
        </p>
      </div>

      {canPerform ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="periodStart">Period start</Label>
            <Input
              id="periodStart"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="periodEnd">Period end</Label>
            <Input
              id="periodEnd"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
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
          <div>
            <Label htmlFor="controlTotal">Control total (optional)</Label>
            <Input
              id="controlTotal"
              value={controlTotal}
              onChange={(e) => setControlTotal(e.target.value)}
              placeholder="e.g. 1000.0000"
            />
          </div>
          <Button type="button" onClick={() => void onCreate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create run'}
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium">Runs</h2>
          {runsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(runsQuery.data?.data ?? []).map((run) => (
                <li key={run.id}>
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setSelectedRunId(run.id)}
                  >
                    {run.periodStart} → {run.periodEnd} · {run.status} ·{' '}
                    {formatMoney(run.varianceAmount, run.currency)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {selectedRunId ? <ReconciliationRunDetail runId={selectedRunId} /> : null}
      </div>
      <p className="text-muted-foreground text-xs">
        <Link href="/app/finance" className="underline">
          Back to finance
        </Link>
      </p>
    </div>
  );
}

function ReconciliationRunDetail({ runId }: { runId: string }): React.JSX.Element {
  const meQuery = useMe();
  const runQuery = useReconciliationRun(runId);
  const itemsQuery = useReconciliationItems(runId);
  const ingestMutation = useIngestSettlements(runId);
  const resolveMutation = useResolveReconItem();
  const completeMutation = useCompleteReconRun(runId);
  const canPerform = canMutate(meQuery.data, FINANCE_PERMISSIONS.reconciliationPerform);
  const canApprove = canMutate(meQuery.data, FINANCE_PERMISSIONS.reconciliationApprove);
  const [ingestJson, setIngestJson] = useState(
    '[{"externalReference":"REF-1","amount":"100.0000","currency":"USD","transactionDate":"2026-07-15"}]',
  );
  const [overrideReason, setOverrideReason] = useState('');
  const [matchPaymentId, setMatchPaymentId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ingestKey, setIngestKey] = useState(() => crypto.randomUUID());
  const [resolveKey, setResolveKey] = useState(() => crypto.randomUUID());
  const [completeKey, setCompleteKey] = useState(() => crypto.randomUUID());

  const run = runQuery.data;
  const busy = ingestMutation.isPending || resolveMutation.isPending || completeMutation.isPending;

  async function onIngest(): Promise<void> {
    setError(null);
    try {
      const lines = JSON.parse(ingestJson) as unknown;
      await ingestMutation.mutateAsync({
        idempotencyKey: ingestKey,
        body: { lines: lines as never },
      });
      setMessage('Settlements ingested.');
      setIngestKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Ingest failed.');
    }
  }

  async function onResolve(
    itemId: string,
    resolution: 'MATCH' | 'EXCEPTION_ACCEPTED',
  ): Promise<void> {
    setError(null);
    try {
      await resolveMutation.mutateAsync({
        itemId,
        idempotencyKey: resolveKey,
        body: {
          resolution,
          reason: `Resolved as ${resolution}`,
          ...(resolution === 'MATCH' && matchPaymentId.trim()
            ? { paymentTransactionId: matchPaymentId.trim() }
            : {}),
        },
      });
      setResolveKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Resolve failed.');
    }
  }

  async function onComplete(): Promise<void> {
    setError(null);
    try {
      await completeMutation.mutateAsync({
        idempotencyKey: completeKey,
        body: { overrideReason: overrideReason || undefined },
      });
      setMessage('Run completed.');
      setCompleteKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Complete failed.');
    }
  }

  if (runQuery.isLoading || !run) {
    return <p className="text-muted-foreground text-sm">Loading run…</p>;
  }

  return (
    <div className="space-y-4 text-sm">
      <h2 className="font-medium">
        Run {run.id.slice(0, 8)} · {run.status}
      </h2>
      <p>
        Matched {formatMoney(run.matchedTotal, run.currency)} · Unmatched{' '}
        {formatMoney(run.unmatchedTotal, run.currency)} · Variance{' '}
        {formatMoney(run.varianceAmount, run.currency)} (tol{' '}
        {formatMoney(run.toleranceAmount, run.currency)})
      </p>
      {canPerform && run.status !== 'COMPLETED' ? (
        <>
          <Label htmlFor="ingest">Settlement lines (JSON)</Label>
          <textarea
            id="ingest"
            className="border-border min-h-24 w-full rounded-md border p-2 font-mono text-xs"
            value={ingestJson}
            onChange={(e) => setIngestJson(e.target.value)}
          />
          <Button type="button" disabled={busy} onClick={() => void onIngest()}>
            {ingestMutation.isPending ? 'Ingesting…' : 'Ingest settlements'}
          </Button>
          <div>
            <Label htmlFor="matchPaymentId">Payment ID for MATCH</Label>
            <Input
              id="matchPaymentId"
              value={matchPaymentId}
              onChange={(e) => setMatchPaymentId(e.target.value)}
              placeholder="Required when matching a line"
            />
          </div>
          <div>
            <Label htmlFor="override">
              Override reason (required over tolerance / open items
              {canApprove ? '' : ' — needs finance.reconciliation.approve'})
            </Label>
            <Input
              id="override"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
            />
          </div>
          <Button type="button" disabled={busy} onClick={() => void onComplete()}>
            {completeMutation.isPending ? 'Completing…' : 'Complete run'}
          </Button>
        </>
      ) : null}
      <ul className="space-y-2">
        {(itemsQuery.data?.data ?? []).map((item) => (
          <li key={item.id} className="border-border rounded-md border p-2">
            <div>
              {item.externalReference ?? '—'} · {item.status} ·{' '}
              {item.externalAmount ? formatMoney(item.externalAmount, run.currency) : '—'}
            </div>
            {canPerform && item.status !== 'MATCHED' && item.status !== 'EXCEPTION_ACCEPTED' ? (
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void onResolve(item.id, 'MATCH')}
                >
                  Match
                </Button>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void onResolve(item.id, 'EXCEPTION_ACCEPTED')}
                >
                  Accept exception
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {message ? (
        <p className="text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
