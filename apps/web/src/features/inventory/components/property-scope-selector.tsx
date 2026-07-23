'use client';

import { useEffect } from 'react';

import { Label } from '@rpm/ui';

import { useMe } from '@/features/admin';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useProperties } from '../hooks/use-properties';

export function PropertyScopeSelector(): React.JSX.Element {
  const meQuery = useMe();
  const organizationId = meQuery.data?.organization?.id;
  const propertyId = usePropertyScopeStore((state) => state.propertyId);
  const setPropertyId = usePropertyScopeStore((state) => state.setPropertyId);
  const propertiesQuery = useProperties();
  const properties = propertiesQuery.data?.data ?? [];

  useEffect(() => {
    setPropertyId('ALL');
  }, [organizationId, setPropertyId]);

  return (
    <div className="space-y-1 px-3 pb-3">
      <Label htmlFor="property-scope" className="text-muted-foreground text-xs">
        Property scope
      </Label>
      <select
        id="property-scope"
        className="border-input bg-background w-full rounded-md border px-2 py-1.5 text-sm"
        value={propertyId}
        onChange={(event) => {
          setPropertyId(event.target.value === 'ALL' ? 'ALL' : event.target.value);
        }}
        disabled={propertiesQuery.isLoading}
      >
        <option value="ALL">All properties</option>
        {properties.map((property) => (
          <option key={property.id} value={property.id}>
            {property.code} — {property.name}
          </option>
        ))}
      </select>
    </div>
  );
}
