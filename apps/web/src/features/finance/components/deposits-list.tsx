'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

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

function isZeroMoney(value: string): boolean {
  return value === '0' || value === '0.00' || value === '0.0000';
}

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
  const [dispositionId, setDispositionId] = useState('');
  const [actors, setActors] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const [approveKey, setApproveKey] = useState(() => crypto.randomUUID());
  const [executeKey, setExecuteKey] = useState(() => crypto.randomUUID());

  const canRequest = canMutate(meQuery.data, FINANCE_PERMISSIONS.depositsDisposition);
  const canApprove = canMutate(meQuery.data, FINANCE_PERMISSIONS.depositsDispositionApprove);
  const canExecute = canMutate(meQuery.data, FINANCE_PERMISSIONS.depositsDispose);
  const busy = createMutation.isPending || approveMutation.isPending || executeMutation.isPending;

  if ((!canRequest && !canApprove && !canExecute) || isZeroMoney(heldAmount)) {
    return null;
  }

  async function onRequest(): Promise<void> {
    setError(null);
    setMessage(null);
    try {
      const created = await createMutation.mutateAsync({
        idempotencyKey: requestKey,
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
      setDispositionId(line.id);
      setActors(`requester=${line.requestedByUserId ?? '—'}; status=${line.status}`);
      setMessage(`Disposition requested (${line.status}). Copy ID for another user to approve.`);
      setRequestKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Request failed.');
    }
  }

  async function onApprove(): Promise<void> {
    if (dispositionId.trim().length === 0) {
      setError('Enter a disposition ID to approve.');
      return;
    }
    setError(null);
    try {
      const approved = await approveMutation.mutateAsync({
        dispositionId: dispositionId.trim(),
        idempotencyKey: approveKey,
        body: { decision: 'APPROVE', reason: 'Approved disposition' },
      });
      setActors(
        `requester=${approved.requestedByUserId ?? '—'}; approver=${approved.approvedByUserId ?? '—'}; status=${approved.status}`,
      );
      setMessage('Disposition approved. Execute with a different actor.');
      setApproveKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Approve failed.');
    }
  }

  async function onExecute(): Promise<void> {
    if (dispositionId.trim().length === 0) {
      setError('Enter a disposition ID to execute.');
      return;
    }
    setError(null);
    try {
      const executed = await executeMutation.mutateAsync({
        dispositionId: dispositionId.trim(),
        idempotencyKey: executeKey,
        body: { executedAt: new Date().toISOString() },
      });
      setActors(
        `requester=${executed.requestedByUserId ?? '—'}; approver=${executed.approvedByUserId ?? '—'}; executor=${executed.executedByUserId ?? '—'}`,
      );
      setMessage(`Disposition executed (${currency}).`);
      setExecuteKey(crypto.randomUUID());
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
            <div>
              <Label htmlFor={`disp-amt-${depositId}`}>Amount</Label>
              <Input
                id={`disp-amt-${depositId}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={heldAmount}
              />
            </div>
            <div>
              <Label htmlFor={`disp-reason-${depositId}`}>Reason</Label>
              <Input
                id={`disp-reason-${depositId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <Button type="button" disabled={busy} onClick={() => void onRequest()}>
            {createMutation.isPending ? 'Requesting…' : 'Request'}
          </Button>
        </>
      ) : null}
      {(canApprove || canExecute) && (
        <div>
          <Label htmlFor={`disp-id-${depositId}`}>Disposition ID (for approve/execute)</Label>
          <Input
            id={`disp-id-${depositId}`}
            value={dispositionId}
            onChange={(e) => setDispositionId(e.target.value)}
            placeholder="Paste disposition UUID from requester"
          />
        </div>
      )}
      {canApprove ? (
        <Button type="button" disabled={busy} onClick={() => void onApprove()}>
          {approveMutation.isPending ? 'Approving…' : 'Approve'}
        </Button>
      ) : null}
      {canExecute ? (
        <Button type="button" disabled={busy} onClick={() => void onExecute()}>
          {executeMutation.isPending ? 'Executing…' : 'Execute'}
        </Button>
      ) : null}
      {actors ? <p className="text-muted-foreground text-xs">{actors}</p> : null}
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
