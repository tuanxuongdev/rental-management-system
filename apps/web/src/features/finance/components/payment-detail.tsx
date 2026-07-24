'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import {
  useAllocatePayment,
  useApproveRefund,
  useExecuteRefund,
  usePayment,
  useReceipt,
  useRequestRefund,
  useReversePayment,
} from '../hooks/use-payments';
import { formatMoney } from '../utils/format-money';
import { FINANCE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

type PaymentDetailProps = {
  paymentId: string;
};

export function PaymentDetail({ paymentId }: PaymentDetailProps): React.JSX.Element {
  const meQuery = useMe();
  const paymentQuery = usePayment(paymentId);
  const canView = hasPermission(meQuery.data, FINANCE_PERMISSIONS.paymentsView);
  const canAllocate = canMutate(meQuery.data, FINANCE_PERMISSIONS.paymentsAllocate);
  const canRefund = canMutate(meQuery.data, FINANCE_PERMISSIONS.refundsRequest);
  const canApproveRefund = canMutate(meQuery.data, FINANCE_PERMISSIONS.refundsApprove);
  const canExecuteRefund = canMutate(meQuery.data, FINANCE_PERMISSIONS.refundsExecute);
  const canReverse = canMutate(meQuery.data, FINANCE_PERMISSIONS.refundsExecute);
  const allocateMutation = useAllocatePayment(paymentId);
  const refundMutation = useRequestRefund();
  const approveRefundMutation = useApproveRefund();
  const executeRefundMutation = useExecuteRefund();
  const reverseMutation = useReversePayment(paymentId);

  const [allocateInvoiceId, setAllocateInvoiceId] = useState('');
  const [allocateAmount, setAllocateAmount] = useState('');
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [allocateIdempotencyKey, setAllocateIdempotencyKey] = useState(() => crypto.randomUUID());
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundId, setRefundId] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refundRequestKey, setRefundRequestKey] = useState(() => crypto.randomUUID());
  const [refundApproveKey, setRefundApproveKey] = useState(() => crypto.randomUUID());
  const [refundExecuteKey, setRefundExecuteKey] = useState(() => crypto.randomUUID());
  const [reverseKey, setReverseKey] = useState(() => crypto.randomUUID());

  const receiptId = paymentQuery.data?.receiptId ?? null;
  const receiptQuery = useReceipt(receiptId ?? '');

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this payment.
      </p>
    );
  }

  if (paymentQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading payment…</p>;
  }

  if (paymentQuery.isError || !paymentQuery.data) {
    const message =
      paymentQuery.error instanceof AuthApiError
        ? paymentQuery.error.message
        : 'Unable to load payment.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const payment = paymentQuery.data;
  const allocations = payment.allocations ?? [];
  const hasUnallocated =
    payment.unallocatedAmount !== '0' &&
    payment.unallocatedAmount !== '0.00' &&
    payment.unallocatedAmount !== '0.0000';

  async function onAllocate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setAllocateError(null);
    try {
      await allocateMutation.mutateAsync({
        idempotencyKey: allocateIdempotencyKey,
        body: {
          allocations: [{ invoiceId: allocateInvoiceId.trim(), amount: allocateAmount.trim() }],
        },
      });
      setAllocateInvoiceId('');
      setAllocateAmount('');
      setAllocateIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setAllocateError(err instanceof AuthApiError ? err.message : 'Unable to allocate payment.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/finance/payments" className="text-muted-foreground text-sm underline">
          Back to payments
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Payment {payment.id.slice(0, 8)}
        </h1>
        <p className="text-muted-foreground text-sm">
          {payment.channel} · {payment.status} · Received{' '}
          {new Date(payment.receivedAt).toLocaleString()}
        </p>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Amount</dt>
          <dd>{formatMoney(payment.amount, payment.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Unallocated</dt>
          <dd>{formatMoney(payment.unallocatedAmount, payment.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Received at</dt>
          <dd>{new Date(payment.receivedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Accounting at</dt>
          <dd>{new Date(payment.accountingAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">External reference</dt>
          <dd>{payment.externalReference ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Evidence</dt>
          <dd>
            {payment.evidenceDocumentId ? (
              <Link
                href={`/app/documents/${payment.evidenceDocumentId}`}
                className="font-mono text-xs underline"
              >
                {payment.evidenceDocumentId.slice(0, 8)}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Receipt</dt>
          <dd>
            {payment.receiptId ? (
              <Link href={`/app/finance/receipts/${payment.receiptId}`} className="underline">
                {receiptQuery.data?.receiptNumber ?? payment.receiptId.slice(0, 8)}
              </Link>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      {payment.notes ? (
        <p className="text-sm">
          <span className="text-muted-foreground">Notes: </span>
          {payment.notes}
        </p>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Allocations</h2>
        {allocations.length === 0 ? (
          <p className="text-muted-foreground text-sm">No allocations yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {allocations.map((allocation) => (
              <li key={allocation.id}>
                <Link href={`/app/finance/invoices/${allocation.invoiceId}`} className="underline">
                  Invoice {allocation.invoiceId.slice(0, 8)}
                </Link>
                {' · '}
                {formatMoney(allocation.amount, allocation.currency)}
              </li>
            ))}
          </ul>
        )}
      </section>

      {canAllocate && hasUnallocated && payment.status === 'SETTLED' ? (
        <form className="max-w-md space-y-3" onSubmit={onAllocate}>
          <h2 className="text-sm font-semibold">Allocate unallocated credit</h2>
          <div className="space-y-1">
            <Label htmlFor="allocateInvoiceId">Invoice ID</Label>
            <Input
              id="allocateInvoiceId"
              value={allocateInvoiceId}
              onChange={(event) => setAllocateInvoiceId(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="allocateAmount">Amount</Label>
            <Input
              id="allocateAmount"
              value={allocateAmount}
              onChange={(event) => setAllocateAmount(event.target.value)}
              placeholder={payment.unallocatedAmount}
              required
            />
          </div>
          {allocateError ? (
            <p className="text-sm text-red-600" role="alert">
              {allocateError}
            </p>
          ) : null}
          <Button type="submit" disabled={allocateMutation.isPending}>
            {allocateMutation.isPending ? 'Allocating…' : 'Allocate'}
          </Button>
        </form>
      ) : null}

      {(canRefund || canApproveRefund || canExecuteRefund) && payment.status === 'SETTLED' ? (
        <div className="max-w-md space-y-3">
          <h2 className="text-sm font-semibold">Refunds (SoD)</h2>
          {canRefund ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="refundAmount">Amount</Label>
                <Input
                  id="refundAmount"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder={payment.amount}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="refundReason">Reason</Label>
                <Input
                  id="refundReason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
              <Button
                type="button"
                disabled={refundMutation.isPending}
                onClick={() => {
                  setActionError(null);
                  void refundMutation
                    .mutateAsync({
                      idempotencyKey: refundRequestKey,
                      body: {
                        paymentTransactionId: payment.id,
                        amount: refundAmount || payment.amount,
                        reason: refundReason || 'Staff refund request',
                      },
                    })
                    .then((refund) => {
                      setRefundId(refund.id);
                      setRefundRequestKey(crypto.randomUUID());
                      setActionMessage(
                        `Refund ${refund.id} ${refund.status}. Share ID with approver/executor.`,
                      );
                    })
                    .catch((err) => {
                      setActionError(
                        err instanceof AuthApiError ? err.message : 'Refund request failed.',
                      );
                    });
                }}
              >
                {refundMutation.isPending ? 'Requesting…' : 'Request refund'}
              </Button>
            </>
          ) : null}
          {(canApproveRefund || canExecuteRefund) && (
            <div className="space-y-1">
              <Label htmlFor="refundId">Refund ID</Label>
              <Input
                id="refundId"
                value={refundId}
                onChange={(e) => setRefundId(e.target.value)}
                placeholder="Paste refund UUID"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {canApproveRefund ? (
              <Button
                type="button"
                disabled={approveRefundMutation.isPending || refundId.trim().length === 0}
                onClick={() => {
                  setActionError(null);
                  void approveRefundMutation
                    .mutateAsync({
                      refundId: refundId.trim(),
                      idempotencyKey: refundApproveKey,
                      body: { decision: 'APPROVE', reason: 'Owner/Admin approve refund' },
                    })
                    .then(() => {
                      setRefundApproveKey(crypto.randomUUID());
                      setActionMessage('Refund approved.');
                    })
                    .catch((err) => {
                      setActionError(
                        err instanceof AuthApiError
                          ? err.message
                          : 'Refund approve failed (SoD or status).',
                      );
                    });
                }}
              >
                {approveRefundMutation.isPending ? 'Approving…' : 'Approve refund'}
              </Button>
            ) : null}
            {canExecuteRefund ? (
              <Button
                type="button"
                disabled={executeRefundMutation.isPending || refundId.trim().length === 0}
                onClick={() => {
                  setActionError(null);
                  void executeRefundMutation
                    .mutateAsync({
                      refundId: refundId.trim(),
                      idempotencyKey: refundExecuteKey,
                      body: {},
                    })
                    .then(() => {
                      setRefundExecuteKey(crypto.randomUUID());
                      setActionMessage('Refund executed.');
                      void paymentQuery.refetch();
                    })
                    .catch((err) => {
                      setActionError(
                        err instanceof AuthApiError
                          ? err.message
                          : 'Refund execute failed (SoD or status).',
                      );
                    });
                }}
              >
                {executeRefundMutation.isPending ? 'Executing…' : 'Execute refund'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {canReverse && payment.status === 'SETTLED' ? (
        <div className="max-w-md space-y-3">
          <h2 className="text-sm font-semibold">Reverse payment</h2>
          <div className="space-y-1">
            <Label htmlFor="reverseReason">Reason (required)</Label>
            <Input
              id="reverseReason"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={reverseMutation.isPending || reverseReason.trim().length < 3}
            onClick={() => {
              setActionError(null);
              void reverseMutation
                .mutateAsync({
                  idempotencyKey: reverseKey,
                  body: { reason: reverseReason.trim() },
                })
                .then(() => {
                  setReverseKey(crypto.randomUUID());
                  setActionMessage('Payment reversed.');
                })
                .catch((err) => {
                  setActionError(err instanceof AuthApiError ? err.message : 'Reverse failed.');
                });
            }}
          >
            {reverseMutation.isPending ? 'Reversing…' : 'Reverse payment'}
          </Button>
        </div>
      ) : null}

      {actionMessage ? (
        <p className="text-muted-foreground text-sm" role="status">
          {actionMessage}
        </p>
      ) : null}
      {actionError ? (
        <p className="text-sm text-red-600" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
