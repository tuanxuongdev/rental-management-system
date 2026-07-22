'use client';

import Link from 'next/link';
import { useState } from 'react';

import { usePlatformStatus } from '@/features/platform/hooks/use-platform-status';
import { getApiBaseUrl } from '@/lib/api-client';

function StatusRow({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger';
}): React.JSX.Element {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
        ? 'text-destructive'
        : 'text-foreground';

  return (
    <div className="border-border grid gap-1 border-b py-3 last:border-b-0 sm:grid-cols-[12rem_1fr] sm:items-center">
      <dt className="text-muted-foreground text-sm font-medium">{label}</dt>
      <dd className={`font-mono text-sm tabular-nums ${toneClass}`}>{value}</dd>
    </div>
  );
}

function checkTone(value: string | undefined): 'default' | 'success' | 'danger' {
  if (value === 'ok' || value === 'skipped') {
    return 'success';
  }
  if (value === 'failed') {
    return 'danger';
  }
  return 'default';
}

export function PlatformStatusPanel(): React.JSX.Element {
  const {
    readinessQuery,
    versionQuery,
    pingQuery,
    echoMutation,
    requestId,
    idempotencyKey,
    summaryMessage,
  } = usePlatformStatus();
  const [echoMessage, setEchoMessage] = useState('hello from status page');

  return (
    <section
      aria-labelledby="platform-status-heading"
      className="border-border bg-card space-y-6 rounded-lg border p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h1 id="platform-status-heading" className="text-2xl font-semibold tracking-tight">
          Platform status
        </h1>
        <p className="text-muted-foreground text-sm">
          Development slice calling API health, readiness, and meta endpoints with shared
          correlation IDs.
        </p>
      </div>

      <p aria-live="polite" className="sr-only" role="status">
        {summaryMessage}
      </p>

      <dl>
        <StatusRow label="API base URL" value={getApiBaseUrl()} />
        <StatusRow label="Outbound request ID" value={requestId} />

        <StatusRow
          label="Readiness"
          value={
            readinessQuery.isLoading
              ? 'Loading…'
              : readinessQuery.isError
                ? 'Failed to load'
                : (readinessQuery.data?.data.status ?? '—')
          }
          tone={
            readinessQuery.isError
              ? 'danger'
              : readinessQuery.isSuccess && readinessQuery.data.data.status === 'ok'
                ? 'success'
                : 'danger'
          }
        />

        <StatusRow
          label="Database check"
          value={readinessQuery.isSuccess ? (readinessQuery.data.data.checks.database ?? '—') : '—'}
          tone={
            readinessQuery.isSuccess
              ? checkTone(readinessQuery.data.data.checks.database)
              : 'default'
          }
        />

        <StatusRow
          label="Version"
          value={
            versionQuery.isLoading
              ? 'Loading…'
              : versionQuery.isError
                ? 'Failed to load'
                : `${versionQuery.data?.data.version} (${versionQuery.data?.data.gitSha})`
          }
          tone={versionQuery.isError ? 'danger' : versionQuery.isSuccess ? 'success' : 'default'}
        />

        <StatusRow
          label="Ping"
          value={
            pingQuery.isLoading
              ? 'Loading…'
              : pingQuery.isError
                ? 'Failed to load'
                : (pingQuery.data?.data.message ?? '—')
          }
          tone={pingQuery.isError ? 'danger' : pingQuery.isSuccess ? 'success' : 'default'}
        />

        <StatusRow
          label="Correlation ID (ping)"
          value={pingQuery.isSuccess ? (pingQuery.data?.data.correlationId ?? '—') : '—'}
        />

        <StatusRow
          label="Trace ID (API)"
          value={pingQuery.isSuccess ? (pingQuery.data?.traceId ?? '—') : '—'}
        />
      </dl>

      <div className="border-border space-y-3 rounded-md border p-4">
        <h2 className="text-sm font-semibold">Idempotent echo (dev demo)</h2>
        <label className="block space-y-1 text-sm" htmlFor="echo-message">
          <span className="text-muted-foreground">Message</span>
          <input
            id="echo-message"
            className="border-input bg-background w-full rounded-md border px-3 py-2"
            value={echoMessage}
            onChange={(event) => setEchoMessage(event.target.value)}
          />
        </label>
        <p className="text-muted-foreground text-xs">Idempotency key: {idempotencyKey}</p>
        <button
          type="button"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          onClick={() => echoMutation.mutate(echoMessage)}
          disabled={echoMutation.isPending}
        >
          {echoMutation.isPending ? 'Sending…' : 'Send idempotent echo'}
        </button>
        {echoMutation.isSuccess ? (
          <p className="text-sm text-emerald-700" role="status">
            Echo {echoMutation.data.data.echoId}
            {echoMutation.data.idempotencyReplayed ? ' (replayed)' : ''}
          </p>
        ) : null}
        {echoMutation.isError ? (
          <p className="text-destructive text-sm" role="alert">
            Echo failed.
          </p>
        ) : null}
      </div>

      <p className="text-muted-foreground text-sm">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to home
        </Link>
      </p>
    </section>
  );
}
