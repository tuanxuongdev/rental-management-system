'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { moveInLease } from '@/lib/leases-api';
import { useAuthStore } from '@/state/auth-store';

import { useLease } from '../hooks/use-lease';
import { LEASE_PERMISSIONS, canMutate } from '../utils/permissions';

export function LeaseMoveIn({ leaseId }: { leaseId: string }): React.JSX.Element {
  const router = useRouter();
  const checklistId = useId();
  const meQuery = useMe();
  const leaseQuery = useLease(leaseId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();
  const canMoveIn = canMutate(meQuery.data, LEASE_PERMISSIONS.moveIn);

  const [acknowledged, setAcknowledged] = useState(false);
  const [keyLabel, setKeyLabel] = useState('Front door key');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !organizationId || !leaseQuery.data) {
        throw new Error('Organization context required');
      }
      return moveInLease(
        accessToken,
        organizationId,
        leaseId,
        {
          checklistAcknowledged: true,
          checklist: [
            { key: 'keys', label: 'Keys issued', completed: true },
            { key: 'condition', label: 'Unit condition reviewed', completed: true },
          ],
          assetCheckouts: keyLabel.trim()
            ? [{ label: keyLabel.trim(), unitId: leaseQuery.data.allocations[0]?.unitId }]
            : [],
        },
        leaseQuery.data.version,
        crypto.randomUUID(),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leases'] });
      router.push(`/app/leases/${leaseId}`);
      router.refresh();
    },
  });

  if (meQuery.isLoading || leaseQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading move-in…</p>;
  }
  if (!canMoveIn) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to record move-in.
      </p>
    );
  }
  if (!leaseQuery.data) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Lease not found.
      </p>
    );
  }

  const lease = leaseQuery.data;
  if (lease.status !== 'ACTIVE' && lease.status !== 'NOTICE') {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Move-in requires an active lease. Current status: {lease.status}.
      </p>
    );
  }
  if (lease.occupancyState !== 'NOT_MOVED_IN') {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Move-in already recorded ({lease.occupancyState}).
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Move-in</h2>
        <p className="text-muted-foreground text-sm">
          Records physical occupancy for {lease.leaseNumber ?? lease.id}. Lease status stays
          contractual; availability reflects occupied inventory after this step.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="key-label">Key / asset label</Label>
        <Input id="key-label" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
      </div>
      <label className="flex items-start gap-2 text-sm" htmlFor={checklistId}>
        <input
          id={checklistId}
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
        />
        <span>I confirm keys, occupants, and unit condition for move-in.</span>
      </label>
      {error || mutation.error ? (
        <p className="text-sm text-red-600" role="alert">
          {error ??
            (mutation.error instanceof AuthApiError ? mutation.error.message : 'Move-in failed.')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!acknowledged || mutation.isPending}
          onClick={() => {
            setError(null);
            if (!acknowledged) {
              setError('Acknowledge the move-in checklist.');
              return;
            }
            mutation.mutate();
          }}
        >
          {mutation.isPending ? 'Recording…' : 'Complete move-in'}
        </Button>
        <Link href={`/app/leases/${leaseId}`} className="text-sm underline">
          Cancel
        </Link>
      </div>
    </div>
  );
}
