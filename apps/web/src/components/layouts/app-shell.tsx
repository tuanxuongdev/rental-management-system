'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

import { UTILITIES_ALLOCATION_ENABLED, type MeResponse } from '@rpm/contracts';

import { OrganizationSwitcher, ReadOnlyBanner, SupportAccessBanner, useMe } from '@/features/admin';
import { DOCUMENT_PERMISSIONS } from '@/features/documents';
import { FINANCE_PERMISSIONS, METERS_PERMISSIONS, UTILITIES_PERMISSIONS } from '@/features/finance';
import { IMPORT_PERMISSIONS, hasPermission } from '@/features/imports';
import { PropertyScopeSelector } from '@/features/inventory';
import { LEASE_PERMISSIONS } from '@/features/leasing';
import { RESIDENT_PERMISSIONS } from '@/features/residents';
import { logoutRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

const homeNav = { href: '/app', label: 'Home' } as const;

const portfolioNav = [
  { href: '/app/portfolio/properties', label: 'Properties' },
  { href: '/app/portfolio/units', label: 'Units' },
  { href: '/app/portfolio/availability', label: 'Availability' },
  { href: '/app/portfolio/owners', label: 'Property Owners' },
  { href: '/app/portfolio/agreements', label: 'Management Agreements' },
] as const;

const adminNavBase = [
  { href: '/app/admin/users', label: 'Users' },
  { href: '/app/admin/invitations', label: 'Invitations' },
  { href: '/app/admin/roles', label: 'Roles' },
  { href: '/app/admin/settings', label: 'Settings' },
] as const;

function navClassName(active: boolean): string {
  return [
    'rounded-md px-3 py-2 text-sm',
    active ? 'bg-accent text-foreground font-medium' : 'text-foreground hover:bg-accent',
  ].join(' ');
}

function buildAdminNav(me: MeResponse | undefined) {
  const items: { href: string; label: string }[] = [...adminNavBase];
  if (hasPermission(me, IMPORT_PERMISSIONS.importsInventory)) {
    items.push({ href: '/app/admin/imports', label: 'Imports' });
  }
  return items;
}

function buildPeopleNav(me: MeResponse | undefined) {
  const items: { href: string; label: string }[] = [];
  if (hasPermission(me, RESIDENT_PERMISSIONS.list)) {
    items.push({ href: '/app/residents', label: 'Residents' });
  }
  if (hasPermission(me, RESIDENT_PERMISSIONS.waitlistList)) {
    items.push({ href: '/app/residents/waitlist', label: 'Waitlist' });
  }
  if (hasPermission(me, DOCUMENT_PERMISSIONS.list)) {
    items.push({ href: '/app/documents', label: 'Documents' });
  }
  return items;
}

function buildLeasingNav(me: MeResponse | undefined) {
  const items: { href: string; label: string }[] = [];
  if (hasPermission(me, LEASE_PERMISSIONS.list)) {
    items.push({ href: '/app/leases', label: 'Leases' });
  }
  return items;
}

function buildFinanceNav(me: MeResponse | undefined) {
  const items: { href: string; label: string }[] = [];
  if (
    hasPermission(me, FINANCE_PERMISSIONS.paymentsList) ||
    hasPermission(me, FINANCE_PERMISSIONS.invoicesList) ||
    hasPermission(me, FINANCE_PERMISSIONS.reportsView)
  ) {
    items.push({ href: '/app/finance', label: 'Overview' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.paymentsList)) {
    items.push({ href: '/app/finance/payments', label: 'Payments' });
  }
  if (
    hasPermission(me, FINANCE_PERMISSIONS.reportsView) ||
    hasPermission(me, FINANCE_PERMISSIONS.paymentsList) ||
    hasPermission(me, FINANCE_PERMISSIONS.invoicesList)
  ) {
    items.push({ href: '/app/finance/arrears', label: 'Arrears' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.reconciliationView)) {
    items.push({ href: '/app/finance/reconciliation', label: 'Reconciliation' });
  }
  if (
    hasPermission(me, FINANCE_PERMISSIONS.periodClose) ||
    hasPermission(me, FINANCE_PERMISSIONS.reconciliationView)
  ) {
    items.push({ href: '/app/finance/periods', label: 'Periods' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.reconciliationPerform)) {
    items.push({ href: '/app/finance/comparisons', label: 'Comparisons' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.exportsCreate)) {
    items.push({ href: '/app/finance/exports', label: 'Exports' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.invoicesList)) {
    items.push({ href: '/app/finance/invoices', label: 'Invoices' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.billingRunPreview)) {
    items.push({ href: '/app/finance/billing', label: 'Billing run' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.depositsView)) {
    items.push({ href: '/app/finance/deposits', label: 'Deposits' });
  }
  if (hasPermission(me, METERS_PERMISSIONS.list)) {
    items.push({ href: '/app/finance/meters', label: 'Meters' });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.invoicesList)) {
    items.push({ href: '/app/finance/credit-notes', label: 'Credit notes' });
  }
  if (UTILITIES_ALLOCATION_ENABLED && hasPermission(me, UTILITIES_PERMISSIONS.allocate)) {
    items.push({ href: '/app/finance/utilities', label: 'Utilities' });
  }
  return items;
}

function isPeopleNavActive(pathname: string, href: string): boolean {
  if (href === '/app/residents') {
    return (
      pathname === '/app/residents' ||
      (pathname.startsWith('/app/residents/') && !pathname.startsWith('/app/residents/waitlist'))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const router = useRouter();
  const pathname = usePathname();
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const switchingOrganization = useAuthStore((state) => state.switchingOrganization);
  const meQuery = useMe();
  const me = meQuery.data;

  const adminNav = useMemo(() => buildAdminNav(me), [me]);
  const peopleNav = useMemo(() => buildPeopleNav(me), [me]);
  const leasingNav = useMemo(() => buildLeasingNav(me), [me]);
  const financeNav = useMemo(() => buildFinanceNav(me), [me]);
  const showOperations = hasPermission(me, IMPORT_PERMISSIONS.operationsRead);

  async function onLogout(): Promise<void> {
    try {
      await logoutRequest(accessToken);
    } finally {
      clearSession();
      router.replace('/login');
    }
  }

  return (
    <div className="bg-background flex min-h-screen">
      <aside className="border-border bg-card hidden w-56 shrink-0 border-r md:flex md:flex-col">
        <div className="border-border border-b px-4 py-4">
          <p className="text-sm font-semibold">{me?.organization?.displayName ?? 'Organization'}</p>
          <p className="text-muted-foreground text-xs">{me?.user.email ?? 'Signed in'}</p>
        </div>
        <OrganizationSwitcher />
        <PropertyScopeSelector />
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary">
          <Link
            href={homeNav.href}
            className={navClassName(pathname === homeNav.href)}
            aria-current={pathname === homeNav.href ? 'page' : undefined}
          >
            {homeNav.label}
          </Link>

          <p className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide">
            Portfolio
          </p>
          {portfolioNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navClassName(active)}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}

          {peopleNav.length > 0 ? (
            <>
              <p className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide">
                People
              </p>
              {peopleNav.map((item) => {
                const active = isPeopleNavActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navClassName(active)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </>
          ) : null}

          {leasingNav.length > 0 ? (
            <>
              <p className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide">
                Leasing
              </p>
              {leasingNav.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navClassName(active)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </>
          ) : null}

          {financeNav.length > 0 ? (
            <>
              <p className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide">
                Finance
              </p>
              {financeNav.map((item) => {
                const active =
                  item.href === '/app/finance'
                    ? pathname === '/app/finance'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={navClassName(active)}
                    aria-current={active ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </>
          ) : null}

          {showOperations ? (
            <>
              <p className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide">
                Shell
              </p>
              <Link
                href="/app/operations"
                className={navClassName(
                  pathname === '/app/operations' || pathname.startsWith('/app/operations/'),
                )}
                aria-current={
                  pathname === '/app/operations' || pathname.startsWith('/app/operations/')
                    ? 'page'
                    : undefined
                }
              >
                Operations
              </Link>
            </>
          ) : null}

          <p className="text-muted-foreground px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide">
            Administration
          </p>
          {adminNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navClassName(active)}
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border flex h-14 items-center justify-between border-b px-4 md:px-6">
          <p className="text-sm font-medium">Staff shell</p>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            onClick={() => void onLogout()}
          >
            Sign out
          </button>
        </header>
        <ReadOnlyBanner visible={Boolean(me?.isReadOnly)} />
        <SupportAccessBanner />
        <main className="flex-1 px-4 py-6 md:px-6">
          {switchingOrganization ? (
            <p className="text-muted-foreground text-sm">Switching Organization…</p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
