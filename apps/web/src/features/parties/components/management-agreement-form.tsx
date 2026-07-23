'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import {
  AGREEMENT_NON_AUTHORIZING_BANNER,
  PORTFOLIO_PERMISSIONS,
  canMutate,
  useProperties,
} from '@/features/inventory';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useCreateManagementAgreement } from '../hooks/use-management-agreements';

export function ManagementAgreementForm(): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const propertiesQuery = useProperties();
  const createAgreement = useCreateManagementAgreement();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.managementAgreementsCreate);

  const [propertyId, setPropertyId] = useState(propertyScope !== 'ALL' ? propertyScope : '');
  const [agreementNumber, setAgreementNumber] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 16));
  const [effectiveTo, setEffectiveTo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (meQuery.isLoading || propertiesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!canCreate) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to create management agreements.
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      const created = await createAgreement.mutateAsync({
        propertyId,
        agreementNumber,
        effectiveFrom: new Date(effectiveFrom).toISOString(),
        effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });
      router.push(`/app/portfolio/agreements/${created.id}`);
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to create agreement.');
    }
  }

  const properties = propertiesQuery.data?.data ?? [];

  return (
    <form
      className="mx-auto max-w-lg space-y-4"
      onSubmit={(event) => void onSubmit(event)}
      noValidate
    >
      <div className="border-border bg-muted/40 rounded-md border px-3 py-2 text-sm" role="note">
        {AGREEMENT_NON_AUTHORIZING_BANNER}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="propertyId">Property (required)</Label>
        <select
          id="propertyId"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={propertyId}
          onChange={(event) => setPropertyId(event.target.value)}
          required
        >
          <option value="">Select property…</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.code} — {property.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="agreementNumber">Agreement number (required)</Label>
        <Input
          id="agreementNumber"
          value={agreementNumber}
          onChange={(event) => setAgreementNumber(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="effectiveFrom">Effective from (required)</Label>
        <Input
          id="effectiveFrom"
          type="datetime-local"
          value={effectiveFrom}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="effectiveTo">Effective to</Label>
        <Input
          id="effectiveTo"
          type="datetime-local"
          value={effectiveTo}
          onChange={(event) => setEffectiveTo(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={createAgreement.isPending || !propertyId}>
          {createAgreement.isPending ? 'Creating…' : 'Create agreement'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/app/portfolio/agreements')}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
