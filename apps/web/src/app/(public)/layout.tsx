import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="from-muted/40 to-background min-h-screen bg-gradient-to-b">
      <header className="border-border bg-background/80 border-b px-6 py-4 backdrop-blur">
        <p className="text-sm font-semibold tracking-tight">Rental Property Management</p>
      </header>
      <div className="mx-auto flex w-full max-w-md flex-col px-6 py-12">{children}</div>
    </div>
  );
}
