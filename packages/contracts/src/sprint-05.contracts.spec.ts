import { describe, expect, it } from 'vitest';

import {
  OWNERSHIP_DOES_NOT_GRANT_ACCESS,
  PERMISSION_KEYS,
  createPropertyRequestSchema,
  createUnitRequestSchema,
  createBedRequestSchema,
  createPropertyOwnerRequestSchema,
  createManagementAgreementRequestSchema,
  propertyResponseSchema,
  ORGANIZATION_PROPERTIES_PATH,
  ORGANIZATION_AVAILABILITY_PATH,
  ORGANIZATION_PROPERTY_OWNERS_PATH,
} from './index';

describe('@rpm/contracts Sprint-05 inventory + parties', () => {
  it('exposes portfolio path constants', () => {
    expect(ORGANIZATION_PROPERTIES_PATH).toBe('/v1/organizations/{organizationId}/properties');
    expect(ORGANIZATION_AVAILABILITY_PATH).toBe('/v1/organizations/{organizationId}/availability');
    expect(ORGANIZATION_PROPERTY_OWNERS_PATH).toBe(
      '/v1/organizations/{organizationId}/property-owners',
    );
  });

  it('includes Sprint-05 permission keys', () => {
    expect(PERMISSION_KEYS.PROPERTIES_ARCHIVE).toBe('properties.archive');
    expect(PERMISSION_KEYS.UNITS_CREATE).toBe('units.create');
    expect(PERMISSION_KEYS.BEDS_CREATE).toBe('beds.create');
    expect(PERMISSION_KEYS.PROPERTY_OWNERS_LIST).toBe('property_owners.list');
    expect(PERMISSION_KEYS.MANAGEMENT_AGREEMENTS_ACTIVATE).toBe('management_agreements.activate');
    expect(PERMISSION_KEYS.OCCUPANCY_VIEW).toBe('occupancy.view');
  });

  it('validates property/unit/bed write schemas', () => {
    const property = createPropertyRequestSchema.parse({
      code: 'P-1',
      name: 'Court',
      propertyType: 'APARTMENT',
      addressLine1: '1 Main',
      city: 'Austin',
      timeZone: 'America/Chicago',
      defaultCurrency: 'USD',
    });
    expect(property.countryCode).toBe('US');

    const unit = createUnitRequestSchema.parse({
      code: '101',
      name: 'Unit 101',
      unitType: 'SHARED_ROOM',
      allocationMode: 'BED',
      capacity: 2,
    });
    expect(unit.allocationMode).toBe('BED');

    const bed = createBedRequestSchema.parse({
      code: 'B1',
      label: 'Bed 1',
    });
    expect(bed.code).toBe('B1');
  });

  it('validates owner/agreement schemas and non-access flag', () => {
    expect(OWNERSHIP_DOES_NOT_GRANT_ACCESS).toBe(true);

    const owner = createPropertyOwnerRequestSchema.parse({
      partyType: 'PERSON',
      displayName: 'Owner',
      ownerCategory: 'INDIVIDUAL',
    });
    expect(owner.displayName).toBe('Owner');

    const agreement = createManagementAgreementRequestSchema.parse({
      propertyId: '00000000-0000-4000-8000-000000000010',
      agreementNumber: 'MA-1',
      effectiveFrom: '2024-01-01T00:00:00.000Z',
    });
    expect(agreement.agreementNumber).toBe('MA-1');
  });

  it('validates property response shape', () => {
    const parsed = propertyResponseSchema.parse({
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000002',
      code: 'P-1',
      name: 'Court',
      propertyType: 'APARTMENT',
      addressLine1: '1 Main',
      addressLine2: null,
      city: 'Austin',
      region: 'TX',
      postalCode: '78701',
      countryCode: 'US',
      timeZone: 'America/Chicago',
      defaultCurrency: 'USD',
      status: 'ACTIVE',
      version: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    });
    expect(parsed.status).toBe('ACTIVE');
  });
});
