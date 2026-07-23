import { describe, expect, it } from 'vitest';

import { validateOutboxTenantContext } from './tenant-context';

describe('validateOutboxTenantContext (T04-09)', () => {
  const orgA = '00000000-0000-4000-8000-0000000000aa';
  const orgB = '00000000-0000-4000-8000-0000000000bb';

  it('allows null tenantId for platform / unscoped payloads', () => {
    expect(validateOutboxTenantContext(null, { hello: 'world' })).toEqual({ ok: true });
  });

  it('rejects null tenantId when payload claims an organization', () => {
    expect(validateOutboxTenantContext(null, { tenantId: orgA })).toEqual({
      ok: false,
      reason: 'MISSING_TENANT_ID',
    });
  });

  it('rejects non-uuid tenantId', () => {
    expect(validateOutboxTenantContext('not-a-uuid', {})).toEqual({
      ok: false,
      reason: 'INVALID_TENANT_ID',
    });
  });

  it('rejects payload that claims a different organization', () => {
    expect(validateOutboxTenantContext(orgA, { organizationId: orgB })).toEqual({
      ok: false,
      reason: 'TENANT_MISMATCH',
    });
  });

  it('allows matching payload tenant', () => {
    expect(validateOutboxTenantContext(orgA, { tenantId: orgA })).toEqual({ ok: true });
  });
});
