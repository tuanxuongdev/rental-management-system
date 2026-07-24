export const LOCALE_STORAGE_KEY = 'rpm-locale' as const;

export const APP_LOCALES = ['en', 'vi'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = 'en';

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  vi: 'Tiếng Việt',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'vi';
}

/** Prefer stored locale; else browser language; else DEFAULT_LOCALE. */
export function detectLocale(
  stored: string | null | undefined,
  browserLanguage?: string,
): AppLocale {
  if (isAppLocale(stored)) {
    return stored;
  }
  const lang = (browserLanguage ?? '').toLowerCase();
  if (lang.startsWith('vi')) {
    return 'vi';
  }
  return DEFAULT_LOCALE;
}

export function applyDocumentLocale(locale: AppLocale): void {
  const root = document.documentElement;
  root.lang = locale;
  root.dataset.locale = locale;
}
