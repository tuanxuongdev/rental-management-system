import { MissingOrganizationContextError } from './organization-context.error';

import type { OrganizationContext } from './organization-context';

/**
 * Base class for repositories that access tenant-owned rows.
 * Refuses queries when Organization context is absent.
 */
export abstract class TenantScopedRepositoryBase {
  protected requireOrganizationContext(
    context: OrganizationContext | null | undefined,
  ): OrganizationContext {
    if (context === null || context === undefined) {
      throw new MissingOrganizationContextError();
    }
    return context;
  }

  protected tenantWhere(context: OrganizationContext): { tenantId: string } {
    return { tenantId: context.organizationId };
  }
}
