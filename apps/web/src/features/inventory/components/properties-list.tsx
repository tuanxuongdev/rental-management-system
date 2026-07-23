'use client';

import Link from 'next/link';

import { useMe } from '@/features/admin';
import { AuthApiError } from '@/lib/auth-api';
import { usePropertyScopeStore } from '@/state/property-scope-store';

import { useProperties } from '../hooks/use-properties';
import { PORTFOLIO_PERMISSIONS, canMutate, hasPermission } from '../utils/permissions';

const primaryLinkClass =
  'bg-primary text-primary-foreground inline-flex h-10 items-center rounded-md px-4 text-sm font-medium';

export function PropertiesList(): React.JSX.Element {
  const meQuery = useMe();
  const propertiesQuery = useProperties();
  const propertyScope = usePropertyScopeStore((state) => state.propertyId);
  const canView = hasPermission(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesList);
  const canCreate = canMutate(meQuery.data, PORTFOLIO_PERMISSIONS.propertiesCreate);

  if (meQuery.isLoading || propertiesQuery.isLoading) {
    return <p className="text-muted-foreground text-sm">Loading properties…</p>;
  }

  if (!canView) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        You do not have permission to list properties.
      </p>
    );
  }

  if (propertiesQuery.isError) {
    const message =
      propertiesQuery.error instanceof AuthApiError
        ? propertiesQuery.error.message
        : 'Unable to load properties.';
    return (
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
    );
  }

  const properties = (propertiesQuery.data?.data ?? []).filter(
    (property) => propertyScope === 'ALL' || property.id === propertyScope,
  );

  return (
    <div className="space-y-4">
      {canCreate ? (
        <div>
          <Link href="/app/portfolio/properties/new" className={primaryLinkClass}>
            Create property
          </Link>
        </div>
      ) : null}

      {properties.length === 0 ? (
        <p className="text-muted-foreground text-sm">No properties yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="px-2 py-2 font-medium">Code</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Type</th>
                <th className="px-2 py-2 font-medium">City</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((property) => (
                <tr key={property.id} className="border-border border-b">
                  <td className="px-2 py-2">
                    <Link
                      href={`/app/portfolio/properties/${property.id}`}
                      className="text-foreground underline-offset-4 hover:underline"
                    >
                      {property.code}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{property.name}</td>
                  <td className="px-2 py-2">{property.propertyType}</td>
                  <td className="px-2 py-2">{property.city}</td>
                  <td className="px-2 py-2">{property.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
