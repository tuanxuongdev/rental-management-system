/**
 * Organization (tenant) execution context.
 * Must be derived from authenticated membership in Sprint-03+.
 */
export type OrganizationContext = {
  readonly organizationId: string;
};

export function createOrganizationContext(organizationId: string): OrganizationContext {
  const trimmed = organizationId.trim();
  if (trimmed.length === 0) {
    throw new Error('Organization id is required');
  }
  return { organizationId: trimmed };
}

/** Marker for models that require Organization scoping in repositories. */
export type TenantOwned = {
  readonly tenantId: string;
};

export const PLATFORM_SCOPE = 'platform' as const;

export type ActorScope = typeof PLATFORM_SCOPE | `org:${string}`;

export function actorScopeFromOrganization(organizationId: string | null | undefined): ActorScope {
  if (
    organizationId === null ||
    organizationId === undefined ||
    organizationId.trim().length === 0
  ) {
    return PLATFORM_SCOPE;
  }
  return `org:${organizationId.trim()}`;
}
