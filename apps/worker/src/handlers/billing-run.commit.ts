/** Shared advisory lock key helper for billing run worker (mirrors API ADR-0006). */
export function billingAdvisoryLockKey(tenantId: string, periodKey: string): string {
  return `billing:${tenantId}:${periodKey}`;
}
