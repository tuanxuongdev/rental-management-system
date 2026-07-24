'use client';

import { ThemeToggle } from '@rpm/ui';

import { useT } from '@/i18n';

/** ThemeToggle wired to the active locale catalog. */
export function LocalizedThemeToggle({
  variant = 'segmented',
  className,
}: {
  variant?: 'cycle' | 'segmented';
  className?: string;
}): React.JSX.Element {
  const t = useT();
  return (
    <ThemeToggle
      className={className}
      variant={variant}
      labels={{
        light: t('theme.light'),
        dark: t('theme.dark'),
        system: t('theme.system'),
        group: t('theme.groupLabel'),
        cycleAria: t('theme.cycleAria'),
        optionAria: t('theme.optionAria'),
      }}
    />
  );
}
