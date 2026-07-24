import { describe, expect, it } from 'vitest';

import {
  activateLeaseRequestSchema,
  createLeaseRequestSchema,
  LEASE_ACTIVATED_EVENT_TYPE,
  LEASE_PERMISSION_KEYS,
  moneyAmountStringSchema,
  ORGANIZATION_LEASE_ACTIVATE_PATH,
  ORGANIZATION_LEASES_PATH,
} from './index';

describe('@rpm/contracts Sprint-08 leases + money', () => {
  it('exposes lease paths and permission keys', () => {
    expect(ORGANIZATION_LEASES_PATH).toBe('/v1/organizations/{organizationId}/leases');
    expect(ORGANIZATION_LEASE_ACTIVATE_PATH).toBe(
      '/v1/organizations/{organizationId}/leases/{leaseId}/activate',
    );
    expect(LEASE_PERMISSION_KEYS.ACTIVATE).toBe('leases.activate');
    expect(LEASE_ACTIVATED_EVENT_TYPE).toBe('lease.activated');
  });

  it('validates create, activate, and money schemas', () => {
    expect(moneyAmountStringSchema.parse('1200.50')).toBe('1200.50');

    const create = createLeaseRequestSchema.parse({
      propertyId: '00000000-0000-4000-8000-000000000001',
      currency: 'USD',
      startDate: '2026-08-01',
      endDate: '2027-07-31',
      rentAmount: '1200.0000',
      depositAmount: '500.00',
      parties: [
        {
          partyId: '00000000-0000-4000-8000-000000000002',
          role: 'PRIMARY_LEASEHOLDER',
          isPrimary: true,
        },
      ],
      allocation: {
        unitId: '00000000-0000-4000-8000-000000000003',
        allocationType: 'WHOLE_UNIT',
      },
    });
    expect(create.currency).toBe('USD');

    const activate = activateLeaseRequestSchema.parse({
      checklistAcknowledged: true,
      overrideDoNotRent: true,
      overrideReason: 'Risk accepted after review',
    });
    expect(activate.checklistAcknowledged).toBe(true);

    expect(() =>
      activateLeaseRequestSchema.parse({
        checklistAcknowledged: true,
        overrideDoNotRent: true,
      }),
    ).toThrow();
  });
});
