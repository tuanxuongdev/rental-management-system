'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type {
  CreateResidentRequest,
  PatchResidentRequest,
  ResidentDuplicateCandidate,
  ResidentResponse,
  ResidentStatus,
} from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { useProperties } from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import { useDuplicateCheck } from '../hooks/use-duplicate-check';
import { useCreateResident, usePatchResident, useResident } from '../hooks/use-residents';
import { RESIDENT_PERMISSIONS, canMutate } from '../utils/permissions';

const STATUSES: ResidentStatus[] = ['PROSPECT', 'ACTIVE', 'FORMER', 'ARCHIVED'];

type ResidentFormProps = { mode: 'create' } | { mode: 'edit'; residentId: string };

function buildContacts(email: string, phone: string): CreateResidentRequest['contacts'] {
  const contacts: NonNullable<CreateResidentRequest['contacts']> = [];
  if (email.trim()) {
    contacts.push({ type: 'EMAIL', value: email.trim(), isPreferred: true });
  }
  if (phone.trim()) {
    contacts.push({ type: 'PHONE', value: phone.trim(), isPreferred: !email.trim() });
  }
  return contacts.length > 0 ? contacts : undefined;
}

function preferredContact(resident: ResidentResponse, type: string): string {
  return resident.contacts?.find((contact) => contact.type === type)?.value ?? '';
}

export function ResidentForm(props: ResidentFormProps): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const propertiesQuery = useProperties();
  const duplicateCheck = useDuplicateCheck();
  const createResident = useCreateResident();
  const residentQuery = useResident(props.mode === 'edit' ? props.residentId : '');
  const patchResident = usePatchResident(props.mode === 'edit' ? props.residentId : '');

  const canCreate = canMutate(meQuery.data, RESIDENT_PERMISSIONS.create);
  const canUpdate = canMutate(meQuery.data, RESIDENT_PERMISSIONS.update);
  const existing = props.mode === 'edit' ? residentQuery.data : undefined;

  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [status, setStatus] = useState<ResidentStatus>('PROSPECT');
  const [preferredPropertyId, setPreferredPropertyId] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ResidentDuplicateCandidate[] | null>(null);
  const [pendingAck, setPendingAck] = useState(false);

  useEffect(() => {
    if (!existing) {
      return;
    }
    setDisplayName(existing.displayName);
    setLegalName(existing.legalName ?? '');
    setStatus(existing.status);
    setPreferredPropertyId(existing.preferredPropertyId ?? '');
    setEmail(preferredContact(existing, 'EMAIL'));
    setPhone(preferredContact(existing, 'PHONE'));
    setNotes(existing.notes ?? '');
  }, [existing]);

  if (meQuery.isLoading || (props.mode === 'edit' && residentQuery.isLoading)) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (props.mode === 'create' && !canCreate) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to create residents.
      </p>
    );
  }

  if (props.mode === 'edit' && !canUpdate) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to update residents.
      </p>
    );
  }

  if (props.mode === 'edit' && (residentQuery.isError || !existing)) {
    return (
      <p className="text-sm text-red-600" role="alert">
        Resident not found.
      </p>
    );
  }

  async function submit(confirmDuplicateProceed: boolean): Promise<void> {
    setError(null);
    const contacts = buildContacts(email, phone);
    const base = {
      displayName: displayName.trim(),
      legalName: legalName.trim() || undefined,
      status,
      preferredPropertyId: preferredPropertyId || undefined,
      notes: notes.trim() || undefined,
      contacts,
      confirmDuplicateProceed: confirmDuplicateProceed || undefined,
    };

    try {
      if (!confirmDuplicateProceed) {
        const result = await duplicateCheck.mutateAsync({
          displayName: base.displayName,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          excludeResidentId: props.mode === 'edit' ? props.residentId : undefined,
        });
        if (result.candidates.length > 0) {
          setCandidates(result.candidates);
          setPendingAck(true);
          return;
        }
      }

      if (props.mode === 'create') {
        const created = await createResident.mutateAsync(base as CreateResidentRequest);
        router.push(`/app/residents/${created.id}`);
        return;
      }

      const body: PatchResidentRequest = {
        displayName: base.displayName,
        legalName: legalName.trim() ? legalName.trim() : null,
        status,
        preferredPropertyId: preferredPropertyId || null,
        notes: notes.trim() ? notes.trim() : null,
        contacts,
      };
      const updated = await patchResident.mutateAsync({
        body,
        version: existing?.version,
      });
      router.push(`/app/residents/${updated.id}`);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError
          ? caught.message
          : props.mode === 'create'
            ? 'Unable to create resident.'
            : 'Unable to update resident.',
      );
    }
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    await submit(false);
  }

  const isPending = createResident.isPending || patchResident.isPending || duplicateCheck.isPending;

  return (
    <form
      className="mx-auto max-w-lg space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {candidates && candidates.length > 0 ? (
        <div
          className="border-border bg-muted/40 space-y-3 rounded-md border px-3 py-3 text-sm"
          role="alert"
        >
          <p className="font-medium">Possible duplicate residents found</p>
          <p className="text-muted-foreground">
            Review matches by record id before continuing. Contact values are not shown here.
          </p>
          <ul className="list-inside list-disc space-y-1">
            {candidates.map((candidate) => (
              <li key={candidate.residentId}>
                <Link
                  href={`/app/residents/${candidate.residentId}`}
                  className="underline-offset-4 hover:underline"
                >
                  {candidate.displayName}
                </Link>
                <span className="text-muted-foreground">
                  {' '}
                  ({candidate.matchReasons.join(', ')})
                </span>
              </li>
            ))}
          </ul>
          {pendingAck ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={isPending} onClick={() => void submit(true)}>
                {props.mode === 'create' ? 'Create anyway' : 'Save anyway'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCandidates(null);
                  setPendingAck(false);
                }}
              >
                Cancel
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="displayName">Preferred name (required)</Label>
        <Input
          id="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="legalName">Legal name</Label>
        <Input
          id="legalName"
          value={legalName}
          onChange={(event) => setLegalName(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">Status</Label>
        <select
          id="status"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value as ResidentStatus)}
        >
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="preferredPropertyId">Preferred property</Label>
        <select
          id="preferredPropertyId"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={preferredPropertyId}
          onChange={(event) => setPreferredPropertyId(event.target.value)}
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
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending || pendingAck}>
          {isPending ? 'Saving…' : props.mode === 'create' ? 'Create resident' : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              props.mode === 'edit' ? `/app/residents/${props.residentId}` : '/app/residents',
            )
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
