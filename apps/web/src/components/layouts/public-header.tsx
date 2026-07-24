'use client';

import { LocalizedThemeToggle } from '@/components/theme/localized-theme-toggle';
import { LocaleSwitcher, useT } from '@/i18n';

export function PublicHeader(): React.JSX.Element {
  const t = useT();

  return (
    <header className="flex items-center justify-between border-b border-[var(--border-default)] bg-[var(--bg-surface)] px-6 py-4">
      <p className="text-sm font-semibold tracking-tight text-[var(--fg-default)]">
        {t('common.productName')}
      </p>
      <div className="flex items-center gap-2">
        <LocaleSwitcher variant="cycle" />
        <LocalizedThemeToggle variant="cycle" />
      </div>
    </header>
  );
}
