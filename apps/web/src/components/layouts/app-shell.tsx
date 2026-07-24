'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, type ReactNode } from 'react';

import { UTILITIES_ALLOCATION_ENABLED, type MeResponse } from '@rpm/contracts';
import { Button, cn } from '@rpm/ui';

import { LocalizedThemeToggle } from '@/components/theme/localized-theme-toggle';
import { OrganizationSwitcher, ReadOnlyBanner, SupportAccessBanner, useMe } from '@/features/admin';
import { DOCUMENT_PERMISSIONS } from '@/features/documents';
import { FINANCE_PERMISSIONS, METERS_PERMISSIONS, UTILITIES_PERMISSIONS } from '@/features/finance';
import { IMPORT_PERMISSIONS, hasPermission } from '@/features/imports';
import { PropertyScopeSelector } from '@/features/inventory';
import { LEASE_PERMISSIONS } from '@/features/leasing';
import { RESIDENT_PERMISSIONS } from '@/features/residents';
import { LocaleSwitcher, useT, type Translator } from '@/i18n';
import { logoutRequest } from '@/lib/auth-api';
import { useAuthStore } from '@/state/auth-store';

const homeNavHref = '/app' as const;

const portfolioNavHrefs = [
  { href: '/app/portfolio/properties', key: 'nav.properties' },
  { href: '/app/portfolio/units', key: 'nav.units' },
  { href: '/app/portfolio/availability', key: 'nav.availability' },
  { href: '/app/portfolio/owners', key: 'nav.propertyOwners' },
  { href: '/app/portfolio/agreements', key: 'nav.managementAgreements' },
] as const;

const adminNavBaseHrefs = [
  { href: '/app/admin/users', key: 'nav.users' },
  { href: '/app/admin/invitations', key: 'nav.invitations' },
  { href: '/app/admin/roles', key: 'nav.roles' },
  { href: '/app/admin/settings', key: 'nav.settings' },
] as const;

function navClassName(active: boolean): string {
  return cn(
    'rounded-[var(--radius-sm)] px-3 py-2 text-sm transition-colors',
    active
      ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-fg)]'
      : 'text-[var(--fg-default)] hover:bg-[var(--bg-muted)]',
  );
}

function buildAdminNav(me: MeResponse | undefined, t: Translator) {
  const items: { href: string; label: string }[] = adminNavBaseHrefs.map((item) => ({
    href: item.href,
    label: t(item.key),
  }));
  if (hasPermission(me, IMPORT_PERMISSIONS.importsInventory)) {
    items.push({ href: '/app/admin/imports', label: t('nav.imports') });
  }
  return items;
}

function buildPeopleNav(me: MeResponse | undefined, t: Translator) {
  const items: { href: string; label: string }[] = [];
  if (hasPermission(me, RESIDENT_PERMISSIONS.list)) {
    items.push({ href: '/app/residents', label: t('nav.residents') });
  }
  if (hasPermission(me, RESIDENT_PERMISSIONS.waitlistList)) {
    items.push({ href: '/app/residents/waitlist', label: t('nav.waitlist') });
  }
  if (hasPermission(me, DOCUMENT_PERMISSIONS.list)) {
    items.push({ href: '/app/documents', label: t('nav.documents') });
  }
  return items;
}

function buildLeasingNav(me: MeResponse | undefined, t: Translator) {
  const items: { href: string; label: string }[] = [];
  if (hasPermission(me, LEASE_PERMISSIONS.list)) {
    items.push({ href: '/app/leases', label: t('nav.leases') });
  }
  return items;
}

function buildFinanceNav(me: MeResponse | undefined, t: Translator) {
  const items: { href: string; label: string }[] = [];
  if (
    hasPermission(me, FINANCE_PERMISSIONS.paymentsList) ||
    hasPermission(me, FINANCE_PERMISSIONS.invoicesList) ||
    hasPermission(me, FINANCE_PERMISSIONS.reportsView)
  ) {
    items.push({ href: '/app/finance', label: t('nav.financeOverview') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.paymentsList)) {
    items.push({ href: '/app/finance/payments', label: t('nav.payments') });
  }
  if (
    hasPermission(me, FINANCE_PERMISSIONS.reportsView) ||
    hasPermission(me, FINANCE_PERMISSIONS.paymentsList) ||
    hasPermission(me, FINANCE_PERMISSIONS.invoicesList)
  ) {
    items.push({ href: '/app/finance/arrears', label: t('nav.arrears') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.reconciliationView)) {
    items.push({ href: '/app/finance/reconciliation', label: t('nav.reconciliation') });
  }
  if (
    hasPermission(me, FINANCE_PERMISSIONS.periodClose) ||
    hasPermission(me, FINANCE_PERMISSIONS.reconciliationView)
  ) {
    items.push({ href: '/app/finance/periods', label: t('nav.periods') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.reconciliationPerform)) {
    items.push({ href: '/app/finance/comparisons', label: t('nav.comparisons') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.exportsCreate)) {
    items.push({ href: '/app/finance/exports', label: t('nav.exports') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.invoicesList)) {
    items.push({ href: '/app/finance/invoices', label: t('nav.invoices') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.billingRunPreview)) {
    items.push({ href: '/app/finance/billing', label: t('nav.billingRun') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.depositsView)) {
    items.push({ href: '/app/finance/deposits', label: t('nav.deposits') });
  }
  if (hasPermission(me, METERS_PERMISSIONS.list)) {
    items.push({ href: '/app/finance/meters', label: t('nav.meters') });
  }
  if (hasPermission(me, FINANCE_PERMISSIONS.invoicesList)) {
    items.push({ href: '/app/finance/credit-notes', label: t('nav.creditNotes') });
  }
  if (UTILITIES_ALLOCATION_ENABLED && hasPermission(me, UTILITIES_PERMISSIONS.allocate)) {
    items.push({ href: '/app/finance/utilities', label: t('nav.utilities') });
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
  const t = useT();
  const accessToken = useAuthStore((state) => state.accessToken);
  const clearSession = useAuthStore((state) => state.clearSession);
  const switchingOrganization = useAuthStore((state) => state.switchingOrganization);
  const meQuery = useMe();
  const me = meQuery.data;

  const adminNav = useMemo(() => buildAdminNav(me, t), [me, t]);
  const peopleNav = useMemo(() => buildPeopleNav(me, t), [me, t]);
  const leasingNav = useMemo(() => buildLeasingNav(me, t), [me, t]);
  const financeNav = useMemo(() => buildFinanceNav(me, t), [me, t]);
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
    <div className="flex min-h-screen bg-[var(--bg-canvas)]">
      <aside className="hidden w-[var(--sidebar-width)] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-subtle)] md:flex md:flex-col">
        <div className="border-b border-[var(--border-default)] px-4 py-4">
          <p className="text-sm font-semibold text-[var(--fg-default)]">
            {me?.organization?.displayName ?? t('common.organization')}
          </p>
          <p className="text-xs text-[var(--fg-muted)]">{me?.user.email ?? t('shell.signedIn')}</p>
        </div>
        <OrganizationSwitcher />
        <PropertyScopeSelector />
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label={t('shell.primaryNav')}>
          <Link
            href={homeNavHref}
            className={navClassName(pathname === homeNavHref)}
            aria-current={pathname === homeNavHref ? 'page' : undefined}
          >
            {t('nav.home')}
          </Link>

          <p className="px-3 pb-1 pt-4 text-[12px] font-medium tracking-wide text-[var(--fg-muted)]">
            {t('shell.sectionPortfolio')}
          </p>
          {portfolioNavHrefs.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={navClassName(active)}
                aria-current={active ? 'page' : undefined}
              >
                {t(item.key)}
              </Link>
            );
          })}

          {peopleNav.length > 0 ? (
            <>
              <p className="px-3 pb-1 pt-4 text-[12px] font-medium tracking-wide text-[var(--fg-muted)]">
                {t('shell.sectionPeople')}
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
              <p className="px-3 pb-1 pt-4 text-[12px] font-medium tracking-wide text-[var(--fg-muted)]">
                {t('shell.sectionLeasing')}
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
              <p className="px-3 pb-1 pt-4 text-[12px] font-medium tracking-wide text-[var(--fg-muted)]">
                {t('shell.sectionFinance')}
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
              <p className="px-3 pb-1 pt-4 text-[12px] font-medium tracking-wide text-[var(--fg-muted)]">
                {t('shell.sectionShell')}
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
                {t('nav.operations')}
              </Link>
            </>
          ) : null}

          <p className="px-3 pb-1 pt-4 text-[12px] font-medium tracking-wide text-[var(--fg-muted)]">
            {t('shell.sectionAdministration')}
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
        <header className="flex h-[var(--topbar-height)] items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-4 md:px-6">
          <p className="text-sm font-medium text-[var(--fg-default)]">{t('shell.staffShell')}</p>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <LocalizedThemeToggle />
            <Button type="button" variant="ghost" size="sm" onClick={() => void onLogout()}>
              {t('shell.signOut')}
            </Button>
          </div>
        </header>
        <ReadOnlyBanner visible={Boolean(me?.isReadOnly)} />
        <SupportAccessBanner />
        <main className="flex-1 px-4 py-6 md:px-6">
          {switchingOrganization ? (
            <p className="text-sm text-[var(--fg-muted)]">{t('shell.switchingOrganization')}</p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
