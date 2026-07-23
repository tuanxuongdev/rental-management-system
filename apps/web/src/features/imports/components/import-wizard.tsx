'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import type { DryRunSummary, ImportJobResponse } from '@rpm/contracts';
import { Button, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { createRequestId } from '@/lib/request-id';

import {
  useCommitImport,
  useCreateImport,
  useDryRunImport,
  useImportErrors,
  useImportJob,
  useInventoryTemplate,
} from '../hooks/use-imports';
import { IMPORT_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

type WizardStep = 'source' | 'review' | 'committed';

function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard(): React.JSX.Element {
  const meQuery = useMe();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<WizardStep>('source');
  const [csvText, setCsvText] = useState('');
  const [importId, setImportId] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<DryRunSummary | null>(null);
  const [committedJob, setCommittedJob] = useState<ImportJobResponse | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const templateQuery = useInventoryTemplate();
  const createImportMutation = useCreateImport();
  const dryRunMutation = useDryRunImport();
  const commitMutation = useCommitImport();
  const errorsMutation = useImportErrors();

  const pollJob = useImportJob(importId, { poll: step === 'committed' });

  const canImport = canMutate(meQuery.data, IMPORT_PERMISSIONS.importsInventory);
  const canView = hasPermission(meQuery.data, IMPORT_PERMISSIONS.importsInventory);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to run inventory imports.
      </p>
    );
  }

  async function onDownloadTemplate(): Promise<void> {
    setError(null);
    try {
      const csv = await templateQuery.refetch().then((result) => {
        if (result.error) {
          throw result.error;
        }
        return result.data;
      });
      if (!csv) {
        throw new Error('Template was empty.');
      }
      downloadText('inventory-import-template.csv', csv);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to download the CSV template.',
      );
    }
  }

  async function onFileSelected(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }
    setError(null);
    try {
      const text = await file.text();
      setCsvText(text);
    } catch {
      setError('Unable to read the selected file.');
    }
  }

  async function onCreateAndDryRun(): Promise<void> {
    if (!canImport) {
      return;
    }
    const trimmed = csvText.trim();
    if (trimmed.length === 0) {
      setError('Paste CSV text or upload a file first.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const job = await createImportMutation.mutateAsync({
        type: 'INVENTORY',
        csvText: trimmed,
      });
      setImportId(job.id);
      const summary = await dryRunMutation.mutateAsync(job.id);
      setDryRun(summary);
      setStep('review');
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : 'Unable to create or dry-run this import.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function onCommit(): Promise<void> {
    if (!canImport || !importId) {
      return;
    }
    setError(null);
    setBusy(true);
    const key = idempotencyKey ?? createRequestId();
    setIdempotencyKey(key);
    try {
      const job = await commitMutation.mutateAsync({ importId, idempotencyKey: key });
      setCommittedJob(job);
      setStep('committed');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to commit this import.');
    } finally {
      setBusy(false);
    }
  }

  async function onDownloadErrors(): Promise<void> {
    if (!importId) {
      return;
    }
    setError(null);
    try {
      const csv = await errorsMutation.mutateAsync(importId);
      downloadText(`import-${importId}-errors.csv`, csv);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to download import errors.',
      );
    }
  }

  function onReset(): void {
    setStep('source');
    setCsvText('');
    setImportId(null);
    setDryRun(null);
    setCommittedJob(null);
    setIdempotencyKey(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  const liveJob = pollJob.data ?? committedJob;
  const counts = dryRun?.counts ?? liveJob?.counts;

  return (
    <div className="space-y-6">
      <ol className="text-muted-foreground flex flex-wrap gap-3 text-xs font-medium uppercase tracking-wide">
        <li className={step === 'source' ? 'text-foreground' : undefined}>1. Source</li>
        <li className={step === 'review' ? 'text-foreground' : undefined}>2. Dry-run</li>
        <li className={step === 'committed' ? 'text-foreground' : undefined}>3. Commit</li>
      </ol>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'source' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void onDownloadTemplate()}>
              Download CSV template
            </Button>
            <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
              Upload CSV
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void onFileSelected(event.target.files?.[0])}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-csv-text">CSV text</Label>
            <textarea
              id="import-csv-text"
              className="border-border bg-background text-foreground min-h-48 w-full rounded-md border px-3 py-2 font-mono text-xs"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder="Paste inventory CSV rows here…"
              spellCheck={false}
              disabled={!canImport || busy}
            />
            <p className="text-muted-foreground text-xs">
              Inventory only. Dry-run validates without changing production data.
            </p>
          </div>

          {canImport ? (
            <Button
              type="button"
              disabled={busy || csvText.trim().length === 0}
              onClick={() => void onCreateAndDryRun()}
            >
              {busy ? 'Validating…' : 'Create and dry-run'}
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm" role="status">
              Read-only session: import commits are disabled.
            </p>
          )}
        </div>
      ) : null}

      {step === 'review' && dryRun ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Dry-run results</h2>
            <p className="text-muted-foreground text-sm">
              Import job <span className="font-mono text-xs">{dryRun.importId}</span>
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div>
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-medium">{dryRun.counts.total}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Accepted</dt>
              <dd className="font-medium">{dryRun.counts.accepted}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rejected</dt>
              <dd className="font-medium">{dryRun.counts.rejected}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Skipped</dt>
              <dd className="font-medium">{dryRun.counts.skipped}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium">{dryRun.status}</dd>
            </div>
          </dl>

          {dryRun.warnings.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Warnings</h3>
              <ul className="list-inside list-disc text-sm">
                {dryRun.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {dryRun.sampleAccepted.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Sample accepted rows</h3>
              <pre className="border-border bg-muted/40 max-h-48 overflow-auto rounded-md border p-3 text-xs">
                {JSON.stringify(dryRun.sampleAccepted, null, 2)}
              </pre>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onReset} disabled={busy}>
              Start over
            </Button>
            {dryRun.counts.rejected > 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={errorsMutation.isPending}
                onClick={() => void onDownloadErrors()}
              >
                Download errors CSV
              </Button>
            ) : null}
            {canImport ? (
              <Button
                type="button"
                disabled={busy || dryRun.counts.accepted === 0}
                onClick={() => void onCommit()}
              >
                {busy ? 'Committing…' : 'Commit import'}
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Commit runs asynchronously. Track progress here or in{' '}
            <Link href="/app/operations" className="underline-offset-4 hover:underline">
              Operations
            </Link>
            .
          </p>
        </div>
      ) : null}

      {step === 'committed' ? (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-medium">Import committed</h2>
            <p className="text-muted-foreground text-sm">
              Job <span className="font-mono text-xs">{importId}</span>
              {pollJob.isFetching ? ' · refreshing…' : null}
            </p>
          </div>

          {liveJob ? (
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="font-medium">{liveJob.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Accepted</dt>
                <dd className="font-medium">{counts?.accepted ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rejected</dt>
                <dd className="font-medium">{counts?.rejected ?? '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Applied</dt>
                <dd className="font-medium">{counts?.applied ?? '—'}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">Waiting for job status…</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={onReset}>
              Import another file
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={errorsMutation.isPending || !importId}
              onClick={() => void onDownloadErrors()}
            >
              Download errors CSV
            </Button>
            <Link
              href="/app/operations"
              className="border-border inline-flex h-10 items-center rounded-md border px-4 text-sm"
            >
              Open Operations
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
