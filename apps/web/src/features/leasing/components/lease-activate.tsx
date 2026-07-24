'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useActivateLease, useLease, useLeaseReview } from '../hooks/use-lease';
import { formatMoney } from '../utils/format-money';
import { LEASE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function LeaseActivate({ leaseId }: { leaseId: string }): React.JSX.Element {
  const router = useRouter();
  const checklistId = useId();
  const consequencesId = useId();
  const meQuery = useMe();
  const leaseQuery = useLease(leaseId);
  const reviewQuery = useLeaseReview(leaseId);
  const activate = useActivateLease(leaseId);

  const canActivate = canMutate(meQuery.data, LEASE_PERMISSIONS.activate);
  const canOverrideDnr = hasPermission(meQuery.data, LEASE_PERMISSIONS.overrideDoNotRent);

  const [checklistAcknowledged, setChecklistAcknowledged] = useState(false);
  const [overrideDoNotRent, setOverrideDoNotRent] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (meQuery.isLoading || leaseQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading activation workspace…</p>;
  }

  if (!canActivate) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to activate leases.
      </p>
    );
  }

  if (leaseQuery.isError || !leaseQuery.data) {
    const message =
      leaseQuery.error instanceof AuthApiError ? leaseQuery.error.message : 'Lease not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const lease = leaseQuery.data;
  if (lease.status !== 'DRAFT') {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Only draft leases can be activated. Current status: {lease.status}.
      </p>
    );
  }

  const review = reviewQuery.data;
  const dnrIssue = review?.issues.some((issue) => issue.code.includes('DO_NOT_RENT'));

  async function onActivate(): Promise<void> {
    setError(null);
    if (!checklistAcknowledged) {
      setError('Acknowledge the activation checklist.');
      return;
    }
    if (dnrIssue) {
      if (!canOverrideDnr) {
        setError('Do-not-rent is active and you lack override permission.');
        return;
      }
      if (!overrideDoNotRent || overrideReason.trim().length < 3) {
        setError('Provide an override reason (min 3 characters) for do-not-rent.');
        return;
      }
    }
    const nonDnrBlocking =
      review?.issues.some(
        (issue) => issue.severity === 'ERROR' && !issue.code.includes('DO_NOT_RENT'),
      ) ?? false;
    if (nonDnrBlocking || (review && !review.ready && !dnrIssue)) {
      setError('Resolve review errors before activation.');
      return;
    }

    try {
      await activate.mutateAsync({
        body: {
          checklistAcknowledged: true,
          ...(overrideDoNotRent
            ? { overrideDoNotRent: true, overrideReason: overrideReason.trim() }
            : {}),
        },
        version: lease.version,
        idempotencyKey: crypto.randomUUID(),
      });
      router.push(`/app/leases/${leaseId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Activation failed.');
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-md border p-4">
        <h2 className="text-sm font-semibold" id={consequencesId}>
          High-risk action — consequences
        </h2>
        <ul
          className="text-muted-foreground list-inside list-disc text-sm"
          aria-labelledby={consequencesId}
        >
          <li>Commercial terms lock after activation.</li>
          <li>Allocation is enforced; overlapping beds/units are rejected.</li>
          <li>
            Occupancy remains vacant until move-in (Sprint-09). Lease status alone does not move
            anyone in.
          </li>
        </ul>
        <p className="text-muted-foreground text-xs">{lease.occupancyNote}</p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Rent</dt>
          <dd>{formatMoney(lease.terms?.rentAmount ?? null, lease.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Deposit</dt>
          <dd>{formatMoney(lease.terms?.depositAmount ?? null, lease.currency)}</dd>
        </div>
      </dl>

      {reviewQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Loading review snapshot…</p>
      ) : review ? (
        <section className="space-y-2">
          <p className="text-sm">
            Review:{' '}
            {review.ready
              ? 'Ready'
              : dnrIssue &&
                  !review.issues.some(
                    (issue) => issue.severity === 'ERROR' && !issue.code.includes('DO_NOT_RENT'),
                  )
                ? 'Blocked — do-not-rent override required'
                : `Blocked (${review.issues.length} issue(s))`}
          </p>
          {!review.ready ? (
            <ul className="text-muted-foreground text-sm">
              {review.issues.map((issue) => (
                <li key={`${issue.code}-${issue.message}`}>
                  [{issue.severity}] {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {dnrIssue && !canOverrideDnr ? (
        <p className="text-sm text-red-600" role="alert">
          An active do-not-rent flag blocks activation. Ask an Owner/Admin with override permission.
        </p>
      ) : null}

      {dnrIssue && canOverrideDnr ? (
        <div className="border-border space-y-3 rounded-md border p-4">
          <p className="text-sm font-medium">Do-not-rent override</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overrideDoNotRent}
              onChange={(event) => setOverrideDoNotRent(event.target.checked)}
            />
            Override do-not-rent with documented reason
          </label>
          {overrideDoNotRent ? (
            <div className="space-y-2">
              <Label htmlFor="override-reason">Override reason</Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                minLength={3}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm" htmlFor={checklistId}>
        <input
          id={checklistId}
          type="checkbox"
          checked={checklistAcknowledged}
          onChange={(event) => setChecklistAcknowledged(event.target.checked)}
        />
        <span>
          I confirm parties, allocation, dates, rent/deposit ({lease.currency}), and overlap checks
          are correct.
        </span>
      </label>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void onActivate()} disabled={activate.isPending}>
          {activate.isPending ? 'Activating…' : 'Activate lease'}
        </Button>
        <Link
          href={`/app/leases/${leaseId}`}
          className="text-muted-foreground inline-flex h-10 items-center text-sm underline-offset-4 hover:underline"
        >
          Back to detail
        </Link>
      </div>
    </div>
  );
}
