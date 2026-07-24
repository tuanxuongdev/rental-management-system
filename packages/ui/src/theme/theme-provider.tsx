'use client';

import * as React from 'react';

import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  applyThemePreference,
  isThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

type ThemeContextValue = {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredTheme(): ThemePreference {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(raw)) {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'system';
}

function enableThemeTransition(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const root = document.documentElement;
  root.classList.add('theme-transition');
  window.setTimeout(() => {
    root.classList.remove('theme-transition');
  }, 220);
}

export type ThemeProviderProps = {
  children: React.ReactNode;
  /** Default when no preference is stored. */
  defaultTheme?: ThemePreference;
  storageKey?: string;
};

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps): React.JSX.Element {
  const [theme, setThemeState] = React.useState<ThemePreference>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>('light');
  const [ready, setReady] = React.useState(false);

  const syncDom = React.useCallback((preference: ThemePreference, animate: boolean) => {
    const resolved = resolveTheme(preference, getSystemDark());
    if (animate) {
      enableThemeTransition();
    }
    applyThemePreference(preference);
    applyResolvedTheme(resolved);
    setResolvedTheme(resolved);
  }, []);

  React.useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    syncDom(stored, false);
    setReady(true);
  }, [syncDom]);

  React.useEffect(() => {
    if (!ready) {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if (theme === 'system') {
        syncDom('system', true);
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [ready, theme, syncDom]);

  const setTheme = React.useCallback(
    (next: ThemePreference) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // ignore quota / private mode
      }
      syncDom(next, true);
    },
    [storageKey, syncDom],
  );

  const cycleTheme = React.useCallback(() => {
    const order: ThemePreference[] = ['light', 'dark', 'system'];
    const index = order.indexOf(theme);
    setTheme(order[(index + 1) % order.length]!);
  }, [theme, setTheme]);

  const value = React.useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      cycleTheme,
    }),
    [theme, resolvedTheme, setTheme, cycleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (ctx === null) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
