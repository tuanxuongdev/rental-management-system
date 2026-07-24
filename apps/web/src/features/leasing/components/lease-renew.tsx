'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { renewLease } from '@/lib/leases-api';
import { useAuthStore } from '@/state/auth-store';

import { useLease } from '../hooks/use-lease';
import { LEASE_PERMISSIONS, canMutate } from '../utils/permissions';

export function LeaseRenew({ leaseId }: { leaseId: string }): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const leaseQuery = useLease(leaseId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const queryClient = useQueryClient();
  const canRenew = canMutate(meQuery.data, LEASE_PERMISSIONS.renew);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!accessToken || !organizationId || !leaseQuery.data) {
        throw new Error('Organization context required');
      }
      return renewLease(
        accessToken,
        organizationId,
        leaseId,
        {
          startDate,
          endDate: endDate.trim() === '' ? null : endDate,
          copyParties: true,
          copyAllocation: true,
        },
        leaseQuery.data.version,
      );
    },
    onSuccess: async (draft) => {
      await queryClient.invalidateQueries({ queryKey: ['leases'] });
      router.push(`/app/leases/${draft.id}`);
      router.refresh();
    },
  });

  if (meQuery.isLoading || leaseQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading renewal…</p>;
  }
  if (!canRenew || !leaseQuery.data) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Renewal is unavailable.
      </p>
    );
  }

  const lease = leaseQuery.data;
  if (lease.status !== 'ACTIVE' && lease.status !== 'NOTICE') {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Only active leases can be renewed.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Renew lease</h2>
        <p className="text-muted-foreground text-sm">
          Creates a draft successor lease linked to {lease.leaseNumber ?? lease.id}. Activate the
          draft separately; Sprint-08 allocation rules still apply.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="renew-start">Start date</Label>
          <Input
            id="renew-start"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="renew-end">End date</Label>
          <Input
            id="renew-end"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>
      {error || mutation.error ? (
        <p className="text-sm text-red-600" role="alert">
          {error ??
            (mutation.error instanceof AuthApiError ? mutation.error.message : 'Renewal failed.')}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={mutation.isPending || startDate.trim() === ''}
          onClick={() => {
            setError(null);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
              setError('Enter a valid start date.');
              return;
            }
            mutation.mutate();
          }}
        >
          {mutation.isPending ? 'Creating…' : 'Create renewal draft'}
        </Button>
        <Link href={`/app/leases/${leaseId}`} className="text-sm underline">
          Cancel
        </Link>
      </div>
    </div>
  );
}
