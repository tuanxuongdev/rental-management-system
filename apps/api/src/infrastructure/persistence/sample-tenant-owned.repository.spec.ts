import { describe, expect, it } from 'vitest';

import { createOrganizationContext } from './organization-context';
import { MissingOrganizationContextError } from './organization-context.error';
import { SampleTenantOwnedRepository } from './sample-tenant-owned.repository';

describe('SampleTenantOwnedRepository', () => {
  const repository = new SampleTenantOwnedRepository();

  it('T02-03: rejects access without organization context', () => {
    expect(() => repository.assertQueryable(null)).toThrow(MissingOrganizationContextError);
    expect(() => repository.assertQueryable(undefined)).toThrow(MissingOrganizationContextError);
  });

  it('returns tenant filter when organization context is present', () => {
    const context = createOrganizationContext('org-123');
    expect(repository.assertQueryable(context)).toEqual({ tenantId: 'org-123' });
  });
});
