/** Shared test helpers placeholder — no domain factories yet. */
export function createTestId(prefix = 'test'): string {
  return `${prefix}_${Date.now().toString(36)}`;
}
