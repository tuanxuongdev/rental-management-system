'use client';

import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useClearDoNotRent, useSetDoNotRent } from '../hooks/use-do-not-rent';
import { useResident } from '../hooks/use-residents';
import { RESIDENT_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function DoNotRentPanel({ residentId }: { residentId: string }): React.JSX.Element | null {
  const meQuery = useMe();
  const residentQuery = useResident(residentId);
  const setFlag = useSetDoNotRent(residentId);
  const clearFlag = useClearDoNotRent(residentId);
  const canManage = canMutate(meQuery.data, RESIDENT_PERMISSIONS.doNotRentManage);
  const canView = hasPermission(meQuery.data, RESIDENT_PERMISSIONS.view);

  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [clearReason, setClearReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!canManage) {
    return null;
  }

  if (meQuery.isLoading || residentQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading do-not-rent…</p>;
  }

  if (!canView || !residentQuery.data) {
    return null;
  }

  const flag = residentQuery.data.activeDoNotRent;
  const isActive = Boolean(flag && flag.status === 'ACTIVE');

  async function onSet(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await setFlag.mutateAsync({
        reason: reason.trim(),
        category: category.trim() || undefined,
      });
      setReason('');
      setSuccess('Do-not-rent flag set.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to set do-not-rent.');
    }
  }

  async function onClear(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await clearFlag.mutateAsync({ reason: clearReason.trim() });
      setClearReason('');
      setSuccess('Do-not-rent flag cleared.');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to clear do-not-rent.');
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="do-not-rent-heading">
      <h3 id="do-not-rent-heading" className="text-base font-semibold">
        Do not rent
      </h3>
      <p className="text-muted-foreground text-sm">
        Status: {isActive ? 'Active' : 'Not flagged'}
        {flag?.category ? ` · ${flag.category}` : ''}
      </p>
      {flag?.id ? (
        <p className="text-sm">
          Flag id {flag.id.slice(0, 8)}… (reason text is not shown in toasts).
        </p>
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

      {!isActive ? (
        <form className="max-w-md space-y-3" onSubmit={(event) => void onSet(event)}>
          <div className="space-y-2">
            <Label htmlFor="dnr-category">Category</Label>
            <Input
              id="dnr-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dnr-reason">Reason (required)</Label>
            <Input
              id="dnr-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={setFlag.isPending}>
            {setFlag.isPending ? 'Saving…' : 'Set do-not-rent'}
          </Button>
        </form>
      ) : (
        <form className="max-w-md space-y-3" onSubmit={(event) => void onClear(event)}>
          <div className="space-y-2">
            <Label htmlFor="dnr-clear-reason">Clear reason (required)</Label>
            <Input
              id="dnr-clear-reason"
              value={clearReason}
              onChange={(event) => setClearReason(event.target.value)}
              required
            />
          </div>
          <Button type="submit" variant="outline" disabled={clearFlag.isPending}>
            {clearFlag.isPending ? 'Clearing…' : 'Clear do-not-rent'}
          </Button>
        </form>
      )}
    </section>
  );
}
