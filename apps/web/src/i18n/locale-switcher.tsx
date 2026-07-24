'use client';

import { Button, cn } from '@rpm/ui';

import { useI18n } from './i18n-provider';
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from './locales';

export type LocaleSwitcherProps = {
  className?: string;
  /** Compact control that cycles en ↔ vi. */
  variant?: 'segmented' | 'cycle';
};

export function LocaleSwitcher({
  className,
  variant = 'segmented',
}: LocaleSwitcherProps): React.JSX.Element {
  const { locale, setLocale, t, ready } = useI18n();

  if (variant === 'cycle') {
    const next: AppLocale = locale === 'en' ? 'vi' : 'en';
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn('min-w-10 font-medium uppercase', className)}
        disabled={!ready}
        aria-label={t('locale.switchTo', { label: LOCALE_LABELS[next] })}
        title={LOCALE_LABELS[locale]}
        onClick={() => setLocale(next)}
      >
        {locale}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={t('locale.groupLabel')}
      className={cn(
        'inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-0.5',
        className,
      )}
    >
      {APP_LOCALES.map((code) => {
        const active = locale === code;
        return (
          <Button
            key={code}
            type="button"
            variant="ghost"
            size="sm"
            disabled={!ready}
            aria-pressed={active}
            aria-label={t('locale.switchTo', { label: LOCALE_LABELS[code] })}
            title={LOCALE_LABELS[code]}
            className={cn(
              'h-8 min-w-10 px-2 text-xs font-medium uppercase',
              active &&
                'bg-[var(--accent-soft)] text-[var(--accent-fg)] hover:bg-[var(--accent-soft)]',
            )}
            onClick={() => setLocale(code)}
          >
            {code}
          </Button>
        );
      })}
    </div>
  );
}
