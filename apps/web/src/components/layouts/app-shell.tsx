import Link from 'next/link';

import type { ReactNode } from 'react';

const navItems = [
  { href: '/app', label: 'Home' },
  { href: '/app/placeholder', label: 'Placeholder' },
] as const;

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border bg-card hidden w-56 shrink-0 border-r md:flex md:flex-col">
        <div className="border-border border-b px-4 py-4">
          <p className="text-sm font-semibold">Organization</p>
          <p className="text-muted-foreground text-xs">Switcher skeleton</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border flex h-14 items-center justify-between border-b px-4 md:px-6">
          <p className="text-sm font-medium">Staff shell</p>
          <p className="text-muted-foreground text-xs">Auth context not established</p>
        </header>
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
