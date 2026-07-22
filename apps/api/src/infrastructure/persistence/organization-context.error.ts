export class MissingOrganizationContextError extends Error {
  readonly code = 'ORGANIZATION_CONTEXT_REQUIRED' as const;

  constructor(message = 'Organization context is required for tenant-owned data access') {
    super(message);
    this.name = 'MissingOrganizationContextError';
  }
}
