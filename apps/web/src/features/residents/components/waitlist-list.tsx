'use client';

import { useState } from 'react';

import type { WaitlistEntryStatus } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { useProperties } from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useCreateWaitlistEntry, useRemoveWaitlistEntry, useWaitlist } from '../hooks/use-waitlist';
import { RESIDENT_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const STATUSES: Array<WaitlistEntryStatus | ''> = [
  '',
  'OPEN',
  'OFFERED',
  'CLOSED',
  'EXPIRED',
  'REMOVED',
];

export function WaitlistList(): React.JSX.Element {
  const meQuery = useMe();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const propertiesQuery = useProperties();
  const [status, setStatus] = useState<WaitlistEntryStatus | ''>('OPEN');
  const [partyId, setPartyId] = useState('');
  const [propertyId, setPropertyId] = useState(propertyScope === 'ALL' ? '' : propertyScope);
  const [priority, setPriority] = useState('100');
  const [consent, setConsent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const waitlistQuery = useWaitlist({
    status: status || undefined,
    propertyId: propertyId || (propertyScope === 'ALL' ? undefined : propertyScope),
  });
  const createEntry = useCreateWaitlistEntry();
  const removeEntry = useRemoveWaitlistEntry();

  const canList = hasPermission(meQuery.data, RESIDENT_PERMISSIONS.waitlistList);
  const canCreate = canMutate(meQuery.data, RESIDENT_PERMISSIONS.waitlistCreate);
  const canRemove = canMutate(meQuery.data, RESIDENT_PERMISSIONS.waitlistRemove);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canList) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list waitlist entries.
      </p>
    );
  }

  if (waitlistQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading waitlist…</p>;
  }

  if (waitlistQuery.isError) {
    const message =
      waitlistQuery.error instanceof AuthApiError
        ? waitlistQuery.error.message
        : 'Unable to load waitlist.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const entries = waitlistQuery.data?.data ?? [];

  async function onCreate(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setFormError(null);
    try {
      await createEntry.mutateAsync({
        partyId: partyId.trim(),
        propertyId: propertyId || undefined,
        priority: Number(priority) || 100,
        criteria: {},
        consentAt: consent ? new Date().toISOString() : undefined,
      });
      setPartyId('');
      setConsent(false);
    } catch (caught) {
      setFormError(
        caught instanceof AuthApiError ? caught.message : 'Unable to create waitlist entry.',
      );
    }
  }

  async function onRemove(entryId: string): Promise<void> {
    const reason = window.prompt('Removal reason (required)');
    if (!reason?.trim()) {
      return;
    }
    try {
      await removeEntry.mutateAsync({ entryId, body: { reason: reason.trim() } });
    } catch (caught) {
      setFormError(
        caught instanceof AuthApiError ? caught.message : 'Unable to remove waitlist entry.',
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label htmlFor="waitlist-status" className="text-muted-foreground text-xs">
            Status
          </label>
          <select
            id="waitlist-status"
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value as WaitlistEntryStatus | '')}
          >
            {STATUSES.map((value) => (
              <option key={value || 'all'} value={value}>
                {value || 'All'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canCreate ? (
        <form
          className="border-border max-w-lg space-y-3 rounded-md border p-4"
          onSubmit={(event) => void onCreate(event)}
        >
          <h3 className="text-sm font-semibold">Add waitlist entry</h3>
          {formError ? (
            <p className="text-sm text-red-600" role="alert">
              {formError}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="waitlist-party">Party id (required)</Label>
            <Input
              id="waitlist-party"
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="waitlist-property">Property</Label>
            <select
              id="waitlist-property"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
            >
              <option value="">None</option>
              {(propertiesQuery.data?.data ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {property.code} — {property.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="waitlist-priority">Priority</Label>
            <Input
              id="waitlist-priority"
              type="number"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              required
            />
            Consent recorded
          </label>
          <Button type="submit" disabled={createEntry.isPending}>
            {createEntry.isPending ? 'Adding…' : 'Add entry'}
          </Button>
        </form>
      ) : null}

      {entries.length === 0 ? (
        <p className="text-muted-foreground text-sm">No waitlist entries.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Party</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Priority</th>
                <th className="px-2 py-2 font-medium">Property</th>
                <th className="px-2 py-2 font-medium">Created</th>
                <th className="px-2 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-border border-b">
                  <td className="px-2 py-2">{entry.partyId.slice(0, 8)}…</td>
                  <td className="px-2 py-2">{entry.status}</td>
                  <td className="px-2 py-2">{entry.priority}</td>
                  <td className="px-2 py-2">{entry.propertyId?.slice(0, 8) ?? '—'}</td>
                  <td className="px-2 py-2">{new Date(entry.createdAt).toLocaleDateString()}</td>
                  <td className="px-2 py-2">
                    {canRemove && entry.status === 'OPEN' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={removeEntry.isPending}
                        onClick={() => void onRemove(entry.id)}
                      >
                        Remove
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
