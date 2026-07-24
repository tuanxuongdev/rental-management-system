/**
 * Blocking inline script for <head> — prevents theme flash before React hydrates.
 * Keep in sync with `@rpm/ui` THEME_STORAGE_KEY (`rpm-theme`) and resolve rules.
 */
const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k='rpm-theme';var s=localStorage.getItem(k);var p=s==='light'||s==='dark'||s==='system'?s:'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';r.dataset.theme=p;r.dataset.resolvedTheme=d?'dark':'light';}catch(e){}})();`;

/** Blocking inline script — must stay in <head> before body paint. */
export function ThemeScript(): React.JSX.Element {
  return (
    <script id="rpm-theme-bootstrap" dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
  );
}
