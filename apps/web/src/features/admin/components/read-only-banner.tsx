'use client';

export function ReadOnlyBanner({ visible }: { visible: boolean }): React.JSX.Element | null {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="border-border bg-muted text-foreground border-b px-4 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      You are in read-only mode. Viewing is allowed; changes are hidden.
    </div>
  );
}
