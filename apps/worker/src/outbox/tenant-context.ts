/**
 * T04-09: Worker outbox tenant-context validation helpers.
 * Reject jobs whose payload claims a different Organization than event.tenantId.
 * Tenant-owned payloads without event.tenantId fail closed.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isNonEmptyUuid(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && UUID_RE.test(value);
}

export type TenantContextValidation =
  | { ok: true }
  | { ok: false; reason: 'INVALID_TENANT_ID' | 'TENANT_MISMATCH' | 'MISSING_TENANT_ID' };

/**
 * When event.tenantId is set, it must be a UUID and must match any payload tenant/org claim.
 * When payload claims an organization but event.tenantId is null → reject (fail closed).
 */
export function validateOutboxTenantContext(
  tenantId: string | null,
  payload: unknown,
): TenantContextValidation {
  const claimed =
    payload !== null && typeof payload === 'object' && !Array.isArray(payload)
      ? ((payload as Record<string, unknown>).tenantId ??
        (payload as Record<string, unknown>).organizationId)
      : undefined;

  if (tenantId === null) {
    if (claimed !== undefined && claimed !== null) {
      return { ok: false, reason: 'MISSING_TENANT_ID' };
    }
    return { ok: true };
  }

  if (!isNonEmptyUuid(tenantId)) {
    return { ok: false, reason: 'INVALID_TENANT_ID' };
  }

  if (claimed === undefined || claimed === null) {
    return { ok: true };
  }

  if (claimed !== tenantId) {
    return { ok: false, reason: 'TENANT_MISMATCH' };
  }

  return { ok: true };
}
