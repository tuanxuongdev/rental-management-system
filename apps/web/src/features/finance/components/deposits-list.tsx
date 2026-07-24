'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useDeposits } from '../hooks/use-deposits';
import {
  useApproveDepositDisposition,
  useCreateDepositDispositions,
  useExecuteDepositDisposition,
} from '../hooks/use-payments';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

function DepositDispositionActions({
  depositId,
  currency,
  heldAmount,
}: {
  depositId: string;
  currency: string;
  heldAmount: string;
}): React.JSX.Element | null {
  const meQuery = useMe();
  const createMutation = useCreateDepositDispositions(depositId);
  const approveMutation = useApproveDepositDisposition();
  const executeMutation = useExecuteDepositDisposition();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('Move-out refund');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actors, setActors] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRequest = canMutate(meQuery.data, FINANCE_PERMISSIONS.depositsDisposition);
  const canApprove = canMutate(meQuery.data, FINANCE_PERMISSIONS.depositsDispositionApprove);
  const canExecute = canMutate(meQuery.data, FINANCE_PERMISSIONS.depositsDispose);

  if (
    (!canRequest && !canApprove && !canExecute) ||
    heldAmount === '0' ||
    heldAmount === '0.0000'
  ) {
    return null;
  }

  async function onRequest(): Promise<void> {
    setError(null);
    setMessage(null);
    try {
      const created = await createMutation.mutateAsync({
        idempotencyKey: crypto.randomUUID(),
        body: {
          effectiveAt: new Date().toISOString(),
          lines: [
            {
              dispositionType: 'REFUND',
              amount: amount || heldAmount,
              reason: reason.trim() || 'Deposit refund',
            },
          ],
        },
      });
      const line = created.lines[0];
      if (line === undefined) {
        throw new Error('Disposition line missing');
      }
      setPendingId(line.id);
      setActors(`requester=${line.requestedByUserId ?? '—'}; status=${line.status}`);
      setMessage(`Disposition requested (${line.status}). Approve with a different user.`);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Request failed.');
    }
  }

  async function onApprove(): Promise<void> {
    if (pendingId === null) {
      return;
    }
    setError(null);
    try {
      const approved = await approveMutation.mutateAsync({
        dispositionId: pendingId,
        idempotencyKey: crypto.randomUUID(),
        body: { decision: 'APPROVE', reason: 'Approved disposition' },
      });
      setActors(
        `requester=${approved.requestedByUserId ?? '—'}; approver=${approved.approvedByUserId ?? '—'}; status=${approved.status}`,
      );
      setMessage('Disposition approved. Execute with a third (or different) actor.');
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Approve failed.');
    }
  }

  async function onExecute(): Promise<void> {
    if (pendingId === null) {
      return;
    }
    setError(null);
    try {
      const executed = await executeMutation.mutateAsync({
        dispositionId: pendingId,
        idempotencyKey: crypto.randomUUID(),
        body: { executedAt: new Date().toISOString() },
      });
      setActors(
        `requester=${executed.requestedByUserId ?? '—'}; approver=${executed.approvedByUserId ?? '—'}; executor=${executed.executedByUserId ?? '—'}`,
      );
      setMessage(`Disposition executed (${currency}).`);
      setPendingId(null);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Execute failed.');
    }
  }

  return (
    <div className="mt-3 space-y-2 border-t pt-3 text-sm">
      <p className="font-medium">Deposit disposition (SoD)</p>
      {canRequest ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              placeholder="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void onRequest()}>
            Request
          </Button>
        </>
      ) : null}
      {canApprove && pendingId ? (
        <Button type="button" onClick={() => void onApprove()}>
          Approve
        </Button>
      ) : null}
      {canExecute && pendingId ? (
        <Button type="button" onClick={() => void onExecute()}>
          Execute
        </Button>
      ) : null}
      {actors ? <p className="text-muted-foreground text-xs">{actors}</p> : null}
      {message ? <p className="text-muted-foreground">{message}</p> : null}
      {error ? (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function DepositsList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const depositsQuery = useDeposits(
    propertyScope === 'ALL' ? undefined : { propertyId: propertyScope },
  );
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.depositsView);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view deposits.
      </p>
    );
  }

  if (depositsQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading deposits…</p>;
  }

  if (depositsQuery.isError) {
    const message =
      depositsQuery.error instanceof AuthApiError
        ? depositsQuery.error.message
        : 'Unable to load deposits.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const deposits = depositsQuery.data?.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deposits</h1>
        <p className="text-muted-foreground text-sm">
          Held security deposits with dual-control disposition.
        </p>
      </div>
      {deposits.length === 0 ? (
        <p className="text-muted-foreground text-sm">No deposits in scope.</p>
      ) : (
        <ul className="space-y-4">
          {deposits.map((deposit) => (
            <li key={deposit.id} className="border-border rounded-md border p-4 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <Link href={`/app/leases/${deposit.leaseId}`} className="underline">
                    Lease {deposit.leaseId.slice(0, 8)}
                  </Link>
                  <p className="text-muted-foreground">
                    Held {formatMoney(deposit.heldAmount, deposit.currency)} · {deposit.status}
                  </p>
                </div>
              </div>
              <DepositDispositionActions
                depositId={deposit.id}
                currency={deposit.currency}
                heldAmount={deposit.heldAmount}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
