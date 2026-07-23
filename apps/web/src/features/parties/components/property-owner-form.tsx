'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { CreatePropertyOwnerRequest } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

type PartyType = CreatePropertyOwnerRequest['partyType'];
type OwnerCategory = CreatePropertyOwnerRequest['ownerCategory'];

import { useMe } from '@/features/admin';
import {
  OWNER_NON_AUTHORIZING_BANNER,
  PORTFOLIO_PERMISSIONS,
  canMutate,
} from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';

import { useCreatePropertyOwner } from '../hooks/use-property-owners';

const PARTY_TYPES: PartyType[] = ['PERSON', 'ORGANIZATION'];
const OWNER_CATEGORIES: OwnerCategory[] = ['INDIVIDUAL', 'COMPANY', 'TRUST', 'OTHER'];

export function PropertyOwnerForm(): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const createOwner = useCreatePropertyOwner();
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertyOwnersCreate);

  const [partyType, setPartyType] = useState<PartyType>('PERSON');
  const [displayName, setDisplayName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ownerCategory, setOwnerCategory] = useState<OwnerCategory>('INDIVIDUAL');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canCreate) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to create property owners.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const created = await createOwner.mutateAsync({
        partyType,
        displayName,
        legalName: legalName.trim() || undefined,
        ownerCategory,
        notes: notes.trim() || undefined,
      });
      router.push(`/app/portfolio/owners/${created.id}`);
    } catch (caught) {
      setError(
        caught instanceof AuthApiError ? caught.message : 'Unable to create property owner.',
      );
    }
  }

  return (
    <form
      className="mx-auto max-w-lg space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm" role="note">
        {OWNER_NON_AUTHORIZING_BANNER}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="partyType">Party type (required)</Label>
        <select
          id="partyType"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={partyType}
          onChange={(event) => setPartyType(event.target.value as PartyType)}
        >
          {PARTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name (required)</Label>
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
        <Label htmlFor="ownerCategory">Owner category (required)</Label>
        <select
          id="ownerCategory"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={ownerCategory}
          onChange={(event) => setOwnerCategory(event.target.value as OwnerCategory)}
        >
          {OWNER_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={createOwner.isPending}>
          {createOwner.isPending ? 'Creating…' : 'Create property owner'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/app/portfolio/owners')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
