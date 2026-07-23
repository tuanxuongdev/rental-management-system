'use client';

import { useState } from 'react';

import type { BulkUnitStatusResponse } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { AuthApiError } from '@/lib/auth-api';

import { useBulkUnitStatus } from '../hooks/use-bulk-status';

type OperationalStatus = 'ACTIVE' | 'UNAVAILABLE' | 'UNDER_MAINTENANCE' | 'RETIRED';

const OPERATIONAL_STATUSES: OperationalStatus[] = [
  'ACTIVE',
  'UNAVAILABLE',
  'UNDER_MAINTENANCE',
  'RETIRED',
];

type BulkStatusBarProps = {
  selectedUnitIds: string[];
  onClearSelection?: () => void;
};

export function BulkStatusBar({
  selectedUnitIds,
  onClearSelection,
}: BulkStatusBarProps): React.JSX.Element | null {
  const bulkStatus = useBulkUnitStatus();
  const [status, setStatus] = useState<OperationalStatus>('ACTIVE');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<BulkUnitStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (selectedUnitIds.length === 0 && !success && !error) {
    return null;
  }

  async function onPreview(): Promise<void> {
    setError(null);
    setSuccess(null);
    if (reason.trim().length === 0) {
      setError('Enter a reason before previewing.');
      return;
    }
    try {
      const result = await bulkStatus.mutateAsync({
        mode: 'PREVIEW',
        unitIds: selectedUnitIds,
        status,
        reason: reason.trim(),
      });
      setPreview(result);
    } catch (caught) {
      setPreview(null);
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to preview bulk status update.',
      );
    }
  }

  async function onCommit(): Promise<void> {
    setError(null);
    setSuccess(null);
    if (reason.trim().length === 0) {
      setError('Enter a reason before committing.');
      return;
    }
    if (preview === null || preview.mode !== 'PREVIEW') {
      setError('Run Preview before committing bulk status changes.');
      return;
    }
    try {
      const result = await bulkStatus.mutateAsync({
        mode: 'COMMIT',
        unitIds: selectedUnitIds,
        status,
        reason: reason.trim(),
      });
      setPreview(result);
      setSuccess(`Updated ${result.updatedCount} unit(s) to ${result.status}.`);
      setReason('');
      onClearSelection?.();
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to commit bulk status update.',
      );
    }
  }

  return (
    <div className="border-border bg-card space-y-3 rounded-md border p-4">
      {selectedUnitIds.length > 0 ? (
        <div className="flex flex-wrap items-end gap-3">
          <p className="text-sm font-medium">Bulk status · {selectedUnitIds.length} selected</p>
          <div className="space-y-1">
            <Label htmlFor="bulk-unit-status">Operational status</Label>
            <select
              id="bulk-unit-status"
              className="border-border bg-background h-10 rounded-md border px-3 text-sm"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OperationalStatus);
                setPreview(null);
                setSuccess(null);
              }}
            >
              {OPERATIONAL_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="bulk-unit-reason">Reason</Label>
            <Input
              id="bulk-unit-reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setSuccess(null);
              }}
              placeholder="Required audit reason"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={bulkStatus.isPending}
            onClick={() => void onPreview()}
          >
            Preview
          </Button>
          <Button
            type="button"
            disabled={bulkStatus.isPending || preview === null || preview.mode !== 'PREVIEW'}
            onClick={() => void onCommit()}
          >
            Commit
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-700" role="status">
          {success}
        </p>
      ) : null}

      {preview ? (
        <div className="space-y-2 text-sm">
          <p>
            Mode <span className="font-medium">{preview.mode}</span> · eligible{' '}
            <span className="font-medium">{preview.eligibleUnitIds.length}</span> · exclusions{' '}
            <span className="font-medium">{preview.exclusions.length}</span>
            {preview.mode === 'COMMIT' ? (
              <>
                {' '}
                · updated <span className="font-medium">{preview.updatedCount}</span>
              </>
            ) : null}
          </p>
          {preview.exclusions.length > 0 ? (
            <ul className="text-muted-foreground list-inside list-disc text-xs">
              {preview.exclusions.slice(0, 10).map((exclusion) => (
                <li key={`${exclusion.unitId}-${exclusion.code}`}>
                  {exclusion.unitId.slice(0, 8)}… — {exclusion.reason} ({exclusion.code})
                </li>
              ))}
              {preview.exclusions.length > 10 ? (
                <li>…and {preview.exclusions.length - 10} more</li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
