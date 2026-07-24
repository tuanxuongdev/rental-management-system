'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import type { CreateLeaseRequest, LeaseAllocationType } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { useProperties, useUnits, useBeds } from '@/features/inventory';
import { useResidents } from '@/features/residents';
import { AuthApiError } from '@/lib/auth-api';

import { useLeaseReview } from '../hooks/use-lease';
import { useCreateLease } from '../hooks/use-leases';
import { formatMoney } from '../utils/format-money';
import { LEASE_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

type WizardStep = 'parties' | 'allocation' | 'terms' | 'review';

const STEPS: WizardStep[] = ['parties', 'allocation', 'terms', 'review'];

function stepLabel(step: WizardStep): string {
  switch (step) {
    case 'parties':
      return 'Parties & property';
    case 'allocation':
      return 'Allocation';
    case 'terms':
      return 'Terms & money';
    case 'review':
      return 'Review';
  }
}

export function LeaseCreateWizard(): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const createLease = useCreateLease();
  const canCreate = canMutate(meQuery.data, LEASE_PERMISSIONS.create);

  const [step, setStep] = useState<WizardStep>('parties');
  const [error, setError] = useState<string | null>(null);

  const [propertyId, setPropertyId] = useState('');
  const [partyId, setPartyId] = useState('');
  const [allocationType, setAllocationType] = useState<LeaseAllocationType>('WHOLE_UNIT');
  const [unitId, setUnitId] = useState('');
  const [bedId, setBedId] = useState('');
  const [capacityQuantity, setCapacityQuantity] = useState('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [notes, setNotes] = useState('');

  const propertiesQuery = useProperties();
  const unitsQuery = useUnits(propertyId || undefined);
  const bedsQuery = useBeds(unitId);
  const residentsQuery = useResidents(propertyId ? { propertyId } : undefined);

  const selectedProperty = propertiesQuery.data?.data.find((row) => row.id === propertyId);
  const currency = selectedProperty?.defaultCurrency ?? 'USD';

  const units = useMemo(() => {
    const pages = unitsQuery.data?.pages ?? [];
    return pages.flatMap((page) => page.data);
  }, [unitsQuery.data?.pages]);

  const filteredUnits = units.filter((unit) => {
    if (allocationType === 'WHOLE_UNIT') {
      return unit.allocationMode === 'WHOLE_UNIT';
    }
    if (allocationType === 'BED') {
      return unit.allocationMode === 'BED';
    }
    return unit.allocationMode === 'CAPACITY';
  });

  const [draftLeaseId, setDraftLeaseId] = useState<string | null>(null);
  const reviewQuery = useLeaseReview(
    draftLeaseId ?? '',
    step === 'review' && draftLeaseId !== null,
  );

  if (meQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }

  if (!hasPermission(meQuery.data, LEASE_PERMISSIONS.create) || !canCreate) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to create leases.
      </p>
    );
  }

  const stepIndex = STEPS.indexOf(step);

  function goNext(): void {
    setError(null);
    const next = STEPS[stepIndex + 1];
    if (next !== undefined) {
      setStep(next);
    }
  }

  function goBack(): void {
    setError(null);
    const prev = STEPS[stepIndex - 1];
    if (prev !== undefined) {
      setStep(prev);
    }
  }

  async function onSubmitDraft(): Promise<void> {
    setError(null);
    if (!propertyId || !partyId || !startDate || !rentAmount || !depositAmount) {
      setError('Complete parties, dates, and money fields.');
      return;
    }

    const body: CreateLeaseRequest = {
      propertyId,
      currency,
      startDate,
      endDate: endDate.trim() || undefined,
      rentAmount: rentAmount.trim(),
      depositAmount: depositAmount.trim(),
      notes: notes.trim() || undefined,
      parties: [{ partyId, role: 'PRIMARY_LEASEHOLDER', isPrimary: true }],
      allocation:
        unitId.trim().length > 0
          ? {
              unitId,
              allocationType,
              ...(allocationType === 'BED' && bedId ? { bedId } : {}),
              ...(allocationType === 'CAPACITY'
                ? { capacityQuantity: Number.parseInt(capacityQuantity, 10) || 1 }
                : {}),
            }
          : undefined,
    };

    try {
      const created = await createLease.mutateAsync(body);
      setDraftLeaseId(created.id);
      setStep('review');
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to create lease draft.');
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <ol className="text-muted-foreground flex flex-wrap gap-2 text-xs">
        {STEPS.map((value, index) => (
          <li key={value} className={value === step ? 'text-foreground font-medium' : undefined}>
            {index + 1}. {stepLabel(value)}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {step === 'parties' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lease-property">Property</Label>
            <select
              id="lease-property"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={propertyId}
              onChange={(event) => {
                setPropertyId(event.target.value);
                setUnitId('');
                setBedId('');
                setPartyId('');
              }}
            >
              <option value="">Select property</option>
              {(propertiesQuery.data?.data ?? []).map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name} ({property.defaultCurrency})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lease-party">Primary resident (party)</Label>
            <select
              id="lease-party"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={partyId}
              onChange={(event) => setPartyId(event.target.value)}
              disabled={!propertyId}
            >
              <option value="">Select resident</option>
              {(residentsQuery.data?.data ?? []).map((resident) => (
                <option key={resident.id} value={resident.partyId}>
                  {resident.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={goNext} disabled={!propertyId || !partyId}>
              Continue
            </Button>
            <Link
              href="/app/leases"
              className="text-muted-foreground text-sm underline-offset-4 hover:underline"
            >
              Cancel
            </Link>
          </div>
        </div>
      ) : null}

      {step === 'allocation' ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="allocation-type">Allocation mode</Label>
            <select
              id="allocation-type"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={allocationType}
              onChange={(event) => {
                setAllocationType(event.target.value as LeaseAllocationType);
                setUnitId('');
                setBedId('');
              }}
            >
              <option value="WHOLE_UNIT">Whole unit</option>
              <option value="BED">Bed</option>
              <option value="CAPACITY">Capacity</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="allocation-unit">Unit</Label>
            <select
              id="allocation-unit"
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              value={unitId}
              onChange={(event) => {
                setUnitId(event.target.value);
                setBedId('');
              }}
            >
              <option value="">Select unit</option>
              {filteredUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.code} · {unit.name}
                </option>
              ))}
            </select>
          </div>
          {allocationType === 'BED' ? (
            <div className="space-y-2">
              <Label htmlFor="allocation-bed">Bed</Label>
              <select
                id="allocation-bed"
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                value={bedId}
                onChange={(event) => setBedId(event.target.value)}
                disabled={!unitId}
              >
                <option value="">Select bed</option>
                {(bedsQuery.data?.data ?? []).map((bed) => (
                  <option key={bed.id} value={bed.id}>
                    {bed.code} · {bed.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {allocationType === 'CAPACITY' ? (
            <div className="space-y-2">
              <Label htmlFor="capacity-qty">Capacity quantity</Label>
              <Input
                id="capacity-qty"
                type="number"
                min={1}
                value={capacityQuantity}
                onChange={(event) => setCapacityQuantity(event.target.value)}
              />
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
            <Button type="button" onClick={goNext}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'terms' ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">Currency: {currency}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End date (optional)</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rent">Rent ({currency})</Label>
              <Input
                id="rent"
                value={rentAmount}
                onChange={(event) => setRentAmount(event.target.value)}
                placeholder="1200.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deposit">Deposit ({currency})</Label>
              <Input
                id="deposit"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                placeholder="1200.00"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lease-notes">Notes</Label>
            <Input
              id="lease-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
            <Button
              type="button"
              onClick={() => void onSubmitDraft()}
              disabled={createLease.isPending}
            >
              {createLease.isPending ? 'Saving draft…' : 'Save draft & review'}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'review' && draftLeaseId ? (
        <div className="space-y-4">
          {reviewQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Running review…</p>
          ) : reviewQuery.data ? (
            <>
              <p className="text-sm">
                Ready for activation:{' '}
                <span className="font-medium">{reviewQuery.data.ready ? 'Yes' : 'No'}</span>
              </p>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {reviewQuery.data.issues.map((issue) => (
                  <li key={`${issue.code}-${issue.message}`}>
                    [{issue.severity}] {issue.message}
                  </li>
                ))}
              </ul>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Rent</dt>
                  <dd>
                    {formatMoney(
                      reviewQuery.data.summary.rentAmount,
                      reviewQuery.data.summary.currency,
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Deposit</dt>
                  <dd>
                    {formatMoney(
                      reviewQuery.data.summary.depositAmount,
                      reviewQuery.data.summary.currency,
                    )}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => router.push(`/app/leases/${draftLeaseId}`)}>
              Open lease detail
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/app/leases/${draftLeaseId}/activate`)}
            >
              Continue to activate
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
