'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { CreatePropertyRequest } from '@rpm/contracts';
import { Button, Input, Label } from '@rpm/ui';

type PropertyType = CreatePropertyRequest['propertyType'];

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';

import { useCreateProperty, usePatchProperty, useProperty } from '../hooks/use-properties';
import { PORTFOLIO_PERMISSIONS, canMutate } from '../utils/permissions';

const PROPERTY_TYPES: PropertyType[] = ['APARTMENT', 'BOARDING_HOUSE', 'MIXED', 'OTHER'];

type PropertyFormProps = {
  mode: 'create' | 'edit';
  propertyId?: string;
};

export function PropertyForm({ mode, propertyId }: PropertyFormProps): React.JSX.Element {
  const router = useRouter();
  const meQuery = useMe();
  const propertyQuery = useProperty(propertyId ?? '');
  const createProperty = useCreateProperty();
  const patchProperty = usePatchProperty(propertyId ?? '');

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<PropertyType>('APARTMENT');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [countryCode, setCountryCode] = useState('US');
  const [timeZone, setTimeZone] = useState('America/New_York');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesCreate);
  const canUpdate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesUpdate);
  const canSubmit = isEdit ? canUpdate : canCreate;

  useEffect(() => {
    if (isEdit && propertyQuery.data) {
      const property = propertyQuery.data;
      setCode(property.code);
      setName(property.name);
      setPropertyType(property.propertyType);
      setAddressLine1(property.addressLine1);
      setAddressLine2(property.addressLine2 ?? '');
      setCity(property.city);
      setRegion(property.region ?? '');
      setPostalCode(property.postalCode ?? '');
      setCountryCode(property.countryCode);
      setTimeZone(property.timeZone);
      setDefaultCurrency(property.defaultCurrency);
    }
  }, [isEdit, propertyQuery.data]);

  if (meQuery.isLoading || (isEdit && propertyQuery.isLoading)) {
    return <p className="text-muted-foreground text-sm">Loading property form…</p>;
  }

  if (!canSubmit) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to {isEdit ? 'update' : 'create'} properties.
      </p>
    );
  }

  if (isEdit && (propertyQuery.isError || !propertyQuery.data)) {
    const message =
      propertyQuery.error instanceof AuthApiError
        ? propertyQuery.error.message
        : 'Property not found.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  async function onSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);

    const body: CreatePropertyRequest = {
      code,
      name,
      propertyType,
      addressLine1,
      addressLine2: addressLine2.trim() || undefined,
      city,
      region: region.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      countryCode,
      timeZone,
      defaultCurrency,
    };

    try {
      if (isEdit && propertyId && propertyQuery.data) {
        await patchProperty.mutateAsync({ body, version: propertyQuery.data.version });
        router.push(`/app/portfolio/properties/${propertyId}`);
        return;
      }
      const created = await createProperty.mutateAsync(body);
      router.push(`/app/portfolio/properties/${created.id}`);
    } catch (caught) {
      setError(caught instanceof AuthApiError ? caught.message : 'Unable to save property.');
    }
  }

  const pending = createProperty.isPending || patchProperty.isPending;

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

      <div className="space-y-2">
        <Label htmlFor="code">Code (required)</Label>
        <Input id="code" value={code} onChange={(event) => setCode(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name (required)</Label>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="propertyType">Type (required)</Label>
        <select
          id="propertyType"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          value={propertyType}
          onChange={(event) => setPropertyType(event.target.value as PropertyType)}
        >
          {PROPERTY_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine1">Address line 1 (required)</Label>
        <Input
          id="addressLine1"
          value={addressLine1}
          onChange={(event) => setAddressLine1(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="addressLine2">Address line 2</Label>
        <Input
          id="addressLine2"
          value={addressLine2}
          onChange={(event) => setAddressLine2(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="city">City (required)</Label>
        <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="region">Region</Label>
        <Input id="region" value={region} onChange={(event) => setRegion(event.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="postalCode">Postal code</Label>
        <Input
          id="postalCode"
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="countryCode">Country code (required)</Label>
        <Input
          id="countryCode"
          value={countryCode}
          onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
          maxLength={2}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="timeZone">Time zone (required)</Label>
        <Input
          id="timeZone"
          value={timeZone}
          onChange={(event) => setTimeZone(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="defaultCurrency">Currency (required)</Label>
        <Input
          id="defaultCurrency"
          value={defaultCurrency}
          onChange={(event) => setDefaultCurrency(event.target.value.toUpperCase())}
          maxLength={3}
          required
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create property'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(
              isEdit && propertyId
                ? `/app/portfolio/properties/${propertyId}`
                : '/app/portfolio/properties',
            )
          }
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
