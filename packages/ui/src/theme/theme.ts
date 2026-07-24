export const THEME_STORAGE_KEY = 'rpm-theme' as const;

export const THEME_OPTIONS = ['light', 'dark', 'system'] as const;

export type ThemePreference = (typeof THEME_OPTIONS)[number];

export type ResolvedTheme = 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === 'system') {
    return systemDark ? 'dark' : 'light';
  }
  return preference;
}

/** Apply resolved appearance to <html>. Does not write localStorage. */
export function applyResolvedTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.dataset.resolvedTheme = resolved;
}

export function applyThemePreference(preference: ThemePreference): void {
  document.documentElement.dataset.theme = preference;
}

/**
 * Inline script for <head> — runs before paint to avoid theme flash.
 * Keep in sync with THEME_STORAGE_KEY / resolve logic.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var s=localStorage.getItem(k);var p=s==='light'||s==='dark'||s==='system'?s:'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.dataset.theme=p;r.dataset.resolvedTheme=d?'dark':'light';}catch(e){}})();`;
