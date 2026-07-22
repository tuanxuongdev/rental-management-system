import { TenantScopedRepositoryBase } from './tenant-scoped-repository.base';

import type { OrganizationContext } from './organization-context';

/**
 * Stub repository proving tenant-owned access requires Organization context.
 * Real domain repositories will extend the same base in Sprint-03+.
 */
export class SampleTenantOwnedRepository extends TenantScopedRepositoryBase {
  assertQueryable(context: OrganizationContext | null | undefined): { tenantId: string } {
    const organization = this.requireOrganizationContext(context);
    return this.tenantWhere(organization);
  }
}
