'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { ManualPaymentChannel } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { useDocumentUpload } from '@/features/documents';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useRecordPayment } from '../hooks/use-payments';
import { FINANCE_PERMISSIONS, canMutate } from '../utils/permissions';

const CHANNELS: ManualPaymentChannel[] = ['CASH', 'BANK_TRANSFER', 'QR', 'CHECK', 'OTHER'];

export function PaymentRecordForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const meQuery = useMe();
  const recordMutation = useRecordPayment();
  const documentUpload = useDocumentUpload();
  const scopedPropertyId = usePropertyScopeStore((state) => state.propertyId);

  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [channel, setChannel] = useState<ManualPaymentChannel>('CASH');
  const [amount, setAmount] = useState(searchParams.get('amount') ?? '');
  const [currency, setCurrency] = useState(searchParams.get('currency') ?? 'USD');
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 16));
  const [leaseId, setLeaseId] = useState(searchParams.get('leaseId') ?? '');
  const [payerPartyId, setPayerPartyId] = useState(searchParams.get('payerPartyId') ?? '');
  const [propertyId, setPropertyId] = useState(
    searchParams.get('propertyId') ?? scopedPropertyId ?? '',
  );
  const [invoiceId, setInvoiceId] = useState(searchParams.get('invoiceId') ?? '');
  const [externalReference, setExternalReference] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canRecord = canMutate(meQuery.data, FINANCE_PERMISSIONS.paymentsRecord);
  const submitting = recordMutation.isPending || documentUpload.isPending;

  const evidenceHint = useMemo(() => {
    if (channel === 'CASH' || channel === 'BANK_TRANSFER') {
      return 'Recommended for audit: upload slip / transfer confirmation.';
    }
    return 'Optional evidence document.';
  }, [channel]);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canRecord) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to record payments.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      let evidenceDocumentId: string | undefined;
      if (evidenceFile !== null) {
        const document = await documentUpload.mutateAsync({
          title: `Payment evidence ${externalReference.trim() || receivedAt}`,
          category: 'PAYMENT_EVIDENCE',
          file: evidenceFile,
          partyId: payerPartyId || undefined,
          propertyId: propertyId || undefined,
          leaseId: leaseId || undefined,
        });
        evidenceDocumentId = document.id;
      }

      const receivedIso = new Date(receivedAt).toISOString();
      const payment = await recordMutation.mutateAsync({
        idempotencyKey,
        body: {
          channel,
          amount,
          currency,
          receivedAt: receivedIso,
          leaseId,
          payerPartyId,
          propertyId,
          externalReference: externalReference.trim() || undefined,
          notes: notes.trim() || undefined,
          evidenceDocumentId,
          allocations: invoiceId.trim().length > 0 ? [{ invoiceId: invoiceId.trim(), amount }] : [],
        },
      });
      router.push(`/app/finance/payments/${payment.id}`);
    } catch (err) {
      if (err instanceof AuthApiError && err.code === 'DUPLICATE_EXTERNAL_REFERENCE') {
        setError(
          'This external reference was already used. Confirm you are not double-posting, then use a unique bank/QR reference.',
        );
        return;
      }
      setError(err instanceof AuthApiError ? err.message : 'Unable to record payment.');
    }
  }

  return (
    <form className="max-w-xl space-y-4" onSubmit={onSubmit}>
      <Link href="/app/finance/payments" className="text-muted-foreground text-sm underline">
        Back to payments
      </Link>
      <div className="space-y-1">
        <Label htmlFor="channel">Channel</Label>
        <select
          id="channel"
          className="border-border bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={channel}
          onChange={(event) => setChannel(event.target.value as ManualPaymentChannel)}
        >
          {CHANNELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="amount">Amount</Label>
          <Input
            id="amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="1000.0000"
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="currency">Currency</Label>
          <Input
            id="currency"
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            maxLength={3}
            required
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="receivedAt">Received at</Label>
        <Input
          id="receivedAt"
          type="datetime-local"
          value={receivedAt}
          onChange={(event) => setReceivedAt(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="propertyId">Property ID</Label>
        <Input
          id="propertyId"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="leaseId">Lease ID</Label>
        <Input
          id="leaseId"
          value={leaseId}
          onChange={(event) => setLeaseId(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="payerPartyId">Payer party ID</Label>
        <Input
          id="payerPartyId"
          value={payerPartyId}
          onChange={(event) => setPayerPartyId(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="invoiceId">Allocate to invoice ID (optional)</Label>
        <Input
          id="invoiceId"
          value={invoiceId}
          onChange={(event) => setInvoiceId(event.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="externalReference">External reference</Label>
        <Input
          id="externalReference"
          value={externalReference}
          onChange={(event) => setExternalReference(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Bank/QR references must be unique per organization (duplicate blocked).
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="evidence">Evidence upload</Label>
        <Input
          id="evidence"
          type="file"
          onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
        />
        <p className="text-muted-foreground text-xs">{evidenceHint}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert" tabIndex={-1}>
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={submitting || !canRecord}>
        {submitting ? 'Recording…' : 'Record payment'}
      </Button>
    </form>
  );
}
