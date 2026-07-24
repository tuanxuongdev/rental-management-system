'use client';

import * as React from 'react';

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  applyDocumentLocale,
  detectLocale,
  isAppLocale,
  type AppLocale,
} from './locales';
import {
  createTranslator,
  loadMessages,
  type Messages,
  type TranslateParams,
  type Translator,
} from './translate';

type I18nContextValue = {
  locale: AppLocale;
  messages: Messages;
  ready: boolean;
  setLocale: (locale: AppLocale) => void;
  t: Translator;
};

const I18nContext = React.createContext<I18nContextValue | null>(null);

function readStoredLocale(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeStoredLocale(storageKey: string, locale: AppLocale): void {
  try {
    window.localStorage.setItem(storageKey, locale);
  } catch {
    // ignore quota / private mode
  }
}

export type I18nProviderProps = {
  children: React.ReactNode;
  defaultLocale?: AppLocale;
  storageKey?: string;
};

export function I18nProvider({
  children,
  defaultLocale = DEFAULT_LOCALE,
  storageKey = LOCALE_STORAGE_KEY,
}: I18nProviderProps): React.JSX.Element {
  const [locale, setLocaleState] = React.useState<AppLocale>(defaultLocale);
  const [messages, setMessages] = React.useState<Messages | null>(null);
  const [fallbackMessages, setFallbackMessages] = React.useState<Messages | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const stored = readStoredLocale(storageKey);
      const next = detectLocale(stored, window.navigator.language);
      const [catalog, enCatalog] = await Promise.all([
        loadMessages(next),
        next === 'en' ? Promise.resolve(null) : loadMessages('en'),
      ]);
      if (cancelled) {
        return;
      }
      applyDocumentLocale(next);
      setLocaleState(next);
      setMessages(catalog);
      setFallbackMessages(enCatalog);
      setReady(true);
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const setLocale = React.useCallback(
    (next: AppLocale) => {
      if (!isAppLocale(next)) {
        return;
      }
      writeStoredLocale(storageKey, next);
      applyDocumentLocale(next);
      setLocaleState(next);
      setReady(false);
      void loadMessages(next).then((catalog) => {
        setMessages(catalog);
        setReady(true);
      });
      if (next !== 'en' && fallbackMessages === null) {
        void loadMessages('en').then(setFallbackMessages);
      }
    },
    [fallbackMessages, storageKey],
  );

  const t = React.useMemo(() => {
    if (!messages) {
      return ((key: string) => key) as Translator;
    }
    return createTranslator(messages, fallbackMessages ?? undefined);
  }, [fallbackMessages, messages]);

  const value = React.useMemo<I18nContextValue>(
    () => ({
      locale,
      messages: messages ?? {},
      ready,
      setLocale,
      t,
    }),
    [locale, messages, ready, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = React.useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return ctx;
}

export function useT(): Translator {
  return useI18n().t;
}

export function useLocale(): {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  ready: boolean;
} {
  const { locale, setLocale, ready } = useI18n();
  return { locale, setLocale, ready };
}

export type { TranslateParams };
