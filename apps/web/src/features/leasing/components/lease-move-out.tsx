'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { completeMoveOut, patchMoveOut, startMoveOut, terminateLease } from '@/lib/leases-api';
import { useAuthStore } from '@/state/auth-store';

import { useLease } from '../hooks/use-lease';
import { LEASE_PERMISSIONS, canMutate } from '../utils/permissions';

const MOVE_OUT_CHECKLIST = [
  { key: 'condition', label: 'Unit/bed condition reviewed', completed: true },
  { key: 'keys', label: 'Keys returned or reconciled', completed: true },
  { key: 'readings', label: 'Final meter reading values captured (checklist)', completed: true },
  {
    key: 'deposit_preview',
    label: 'Deposit disposition preview recorded (pending finance)',
    completed: true,
  },
] as const;

export function LeaseMoveOut({ leaseId }: { leaseId: string }): React.JSX.Element {
  const router = useRouter();
  const confirmId = useId();
  const meQuery = useMe();
  const leaseQuery = useLease(leaseId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();
  const canMoveOut = canMutate(meQuery.data, LEASE_PERMISSIONS.moveOut);
  const canTerminate = canMutate(meQuery.data, LEASE_PERMISSIONS.terminate);

  const [confirmed, setConfirmed] = useState(false);
  const [reason, setReason] = useState('End of tenancy');
  const [error, setError] = useState<string | null>(null);

  async function invalidate(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['leases'] });
    await leaseQuery.refetch();
  }

  const startMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !organizationId || !leaseQuery.data) {
        throw new Error('Organization context required');
      }
      return startMoveOut(accessToken, organizationId, leaseId, leaseQuery.data.version);
    },
    onSuccess: () => void invalidate(),
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !organizationId || !leaseQuery.data) {
        throw new Error('Organization context required');
      }
      let version = leaseQuery.data.version;
      const patched = await patchMoveOut(
        accessToken,
        organizationId,
        leaseId,
        {
          checklist: [...MOVE_OUT_CHECKLIST],
          returnAllIssuedKeys: true,
          depositDispositionPreview: {
            outcome: 'PENDING_FINANCE',
            notes: 'Pending finance disposition (Sprint-10)',
          },
        },
        version,
      );
      version = patched.version;
      const completed = await completeMoveOut(
        accessToken,
        organizationId,
        leaseId,
        {
          checklistAcknowledged: true,
          confirmation: true,
          keysReconciled: true,
        },
        version,
        crypto.randomUUID(),
      );
      if (canTerminate) {
        await terminateLease(
          accessToken,
          organizationId,
          leaseId,
          { reason: reason.trim(), confirmation: true, inventoryRelease: true },
          completed.version,
          crypto.randomUUID(),
        );
      }
      return completed;
    },
    onSuccess: async () => {
      await invalidate();
      router.push(`/app/leases/${leaseId}`);
      router.refresh();
    },
  });

  if (meQuery.isLoading || leaseQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading move-out…</p>;
  }
  if (!canMoveOut || !leaseQuery.data) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Move-out is unavailable.
      </p>
    );
  }

  const lease = leaseQuery.data;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Move-out checkout</h2>
        <p className="text-muted-foreground text-sm">{lease.depositDispositionNote}</p>
        <p className="text-muted-foreground text-xs">
          Occupancy: {lease.occupancyState} · Checkout: {lease.moveOutStatus}
        </p>
      </div>

      {lease.occupancyState === 'OCCUPIED' && lease.moveOutStatus === 'NONE' ? (
        <Button
          type="button"
          disabled={startMutation.isPending}
          onClick={() => startMutation.mutate()}
        >
          {startMutation.isPending ? 'Starting…' : 'Start checkout'}
        </Button>
      ) : null}

      {lease.moveOutStatus === 'IN_PROGRESS' ? (
        <div className="space-y-4">
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            {MOVE_OUT_CHECKLIST.map((item) => (
              <li key={item.key}>{item.label}</li>
            ))}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="term-reason">Termination reason (after checkout)</Label>
            <Input
              id="term-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={3}
            />
          </div>
          {!canTerminate ? (
            <p className="text-muted-foreground text-xs" role="status">
              Checkout will complete without terminate (missing leases.terminate).
            </p>
          ) : null}
          <label className="flex items-start gap-2 text-sm" htmlFor={confirmId}>
            <input
              id={confirmId}
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I confirm condition checklist, key return, and that deposit disposition remains
              pending finance (Sprint-10).
            </span>
          </label>
          <Button
            type="button"
            disabled={!confirmed || completeMutation.isPending || reason.trim().length < 3}
            onClick={() => {
              setError(null);
              completeMutation.mutate();
            }}
          >
            {completeMutation.isPending
              ? 'Completing…'
              : canTerminate
                ? 'Complete move-out & terminate'
                : 'Complete move-out'}
          </Button>
        </div>
      ) : null}

      {lease.moveOutStatus === 'COMPLETED' ? (
        <p className="text-sm" role="status">
          Checkout completed{lease.status === 'ENDED' ? ' and lease ended.' : '.'}
        </p>
      ) : null}

      {error || startMutation.error || completeMutation.error ? (
        <p className="text-sm text-red-600" role="alert">
          {error ??
            ((startMutation.error ?? completeMutation.error) instanceof AuthApiError
              ? (startMutation.error ?? completeMutation.error)!.message
              : 'Move-out failed.')}
        </p>
      ) : null}

      <Link href={`/app/leases/${leaseId}`} className="text-sm underline">
        Back to lease
      </Link>
    </div>
  );
}
