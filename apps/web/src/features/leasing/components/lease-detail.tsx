'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { DOCUMENT_PERMISSIONS, canMutate as canMutateDocuments } from '@/features/documents';
import { AuthApiError } from '@/lib/auth-api';
import { createDocumentLink } from '@/lib/documents-api';
import { useAuthStore } from '@/state/auth-store';

import { useLease, useLeaseHistory, useOccupancyEvents } from '../hooks/use-lease';
import { formatMoney } from '../utils/format-money';
import { LEASE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

export function LeaseDetail({ leaseId }: { leaseId: string }): React.JSX.Element {
  const meQuery = useMe();
  const accessToken = useAuthStore((state) => state.accessToken);
  const organizationId = meQuery.data?.organization?.id;
  const leaseQuery = useLease(leaseId);
  const historyQuery = useLeaseHistory(leaseId);
  const occupancyQuery = useOccupancyEvents(leaseId);
  const canView = hasPermission(meQuery.data, LEASE_PERMISSIONS.view);
  const canActivate = canMutate(meQuery.data, LEASE_PERMISSIONS.activate);
  const canMoveIn = canMutate(meQuery.data, LEASE_PERMISSIONS.moveIn);
  const canMoveOut = canMutate(meQuery.data, LEASE_PERMISSIONS.moveOut);
  const canRenew = canMutate(meQuery.data, LEASE_PERMISSIONS.renew);
  const canLinkDocument = canMutateDocuments(meQuery.data, DOCUMENT_PERMISSIONS.upload);

  const [linkDocumentId, setLinkDocumentId] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);

  if (meQuery.isLoading || leaseQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading lease…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to view this lease.
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
  const primaryParty = lease.parties.find((party) => party.isPrimary) ?? lease.parties[0];

  async function onLinkDocument(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setLinkError(null);
    if (!accessToken || !organizationId || !linkDocumentId.trim()) {
      setLinkError('Enter a READY document id.');
      return;
    }
    setLinkBusy(true);
    try {
      await createDocumentLink(accessToken, organizationId, linkDocumentId.trim(), {
        linkType: 'LEASE',
        leaseId,
      });
      setLinkDocumentId('');
    } catch (caught) {
      setLinkError(caught instanceof AuthApiError ? caught.message : 'Unable to link document.');
    } finally {
      setLinkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            {lease.leaseNumber ?? 'Draft lease'}
          </h2>
          <p className="text-muted-foreground text-sm">
            {lease.status} · {lease.occupancyState}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">{lease.occupancyNote}</p>
          <p className="text-muted-foreground text-xs">{lease.depositDispositionNote}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lease.status === 'DRAFT' && canActivate ? (
            <Link
              href={`/app/leases/${leaseId}/activate`}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Activate
            </Link>
          ) : null}
          {(lease.status === 'ACTIVE' || lease.status === 'NOTICE') &&
          lease.occupancyState === 'NOT_MOVED_IN' &&
          canMoveIn ? (
            <Link
              href={`/app/leases/${leaseId}/move-in`}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium"
            >
              Move-in
            </Link>
          ) : null}
          {lease.occupancyState === 'OCCUPIED' && canMoveOut ? (
            <Link
              href={`/app/leases/${leaseId}/move-out`}
              className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
            >
              Move-out
            </Link>
          ) : null}
          {(lease.status === 'ACTIVE' || lease.status === 'NOTICE') && canRenew ? (
            <Link
              href={`/app/leases/${leaseId}/renew`}
              className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
            >
              Renew
            </Link>
          ) : null}
          <Link
            href={`/app/documents/upload?leaseId=${encodeURIComponent(leaseId)}`}
            className="border-input bg-background inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Upload lease document
          </Link>
        </div>
      </div>

      <dl className="grid max-w-3xl gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Rent</dt>
          <dd>{formatMoney(lease.terms?.rentAmount ?? null, lease.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Deposit</dt>
          <dd>{formatMoney(lease.terms?.depositAmount ?? null, lease.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Term</dt>
          <dd>
            {lease.startDate}
            {lease.endDate ? ` → ${lease.endDate}` : ' → open-ended'}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Primary party</dt>
          <dd>{primaryParty?.displayName ?? primaryParty?.partyId ?? '—'}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Allocation</dt>
          <dd>
            {lease.allocations.length === 0
              ? 'None'
              : lease.allocations
                  .map(
                    (row) =>
                      `${row.allocationType} · unit ${row.unitId.slice(0, 8)}…${
                        row.bedId ? ` · bed ${row.bedId.slice(0, 8)}…` : ''
                      }`,
                  )
                  .join('; ')}
          </dd>
        </div>
        {lease.notes ? (
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Notes</dt>
            <dd>{lease.notes}</dd>
          </div>
        ) : null}
      </dl>

      {canLinkDocument ? (
        <section className="border-border max-w-lg space-y-3 rounded-md border p-4">
          <h3 className="text-sm font-semibold">Link existing document</h3>
          <p className="text-muted-foreground text-xs">
            Paste a READY document id to attach it to this lease (or upload with leaseId in the
            query string).
          </p>
          <form className="space-y-2" onSubmit={(event) => void onLinkDocument(event)}>
            {linkError ? (
              <p className="text-sm text-red-600" role="alert">
                {linkError}
              </p>
            ) : null}
            <Label htmlFor="link-document-id">Document id</Label>
            <Input
              id="link-document-id"
              value={linkDocumentId}
              onChange={(event) => setLinkDocumentId(event.target.value)}
              placeholder="00000000-0000-4000-8000-000000000000"
            />
            <Button type="submit" disabled={linkBusy}>
              {linkBusy ? 'Linking…' : 'Link document'}
            </Button>
          </form>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Status timeline</h3>
        {historyQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading history…</p>
        ) : (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {(historyQuery.data?.data ?? []).map((event) => (
              <li key={event.id}>
                {event.fromStatus ?? '—'} → {event.toStatus} ·{' '}
                {new Date(event.recordedAt).toLocaleString()}
                {event.reason ? ` · ${event.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Occupancy timeline</h3>
        {occupancyQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">Loading occupancy…</p>
        ) : (occupancyQuery.data?.data ?? []).length === 0 ? (
          <p className="text-muted-foreground text-sm" role="status">
            No occupancy events yet.
          </p>
        ) : (
          <ul className="text-muted-foreground space-y-1 text-sm">
            {(occupancyQuery.data?.data ?? []).map((event) => (
              <li key={event.id}>
                {event.eventType.replaceAll('_', ' ')} ·{' '}
                {new Date(event.occurredAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
