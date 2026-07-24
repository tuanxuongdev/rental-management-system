/**
 * Blocking inline script for <head> — sets html lang before paint.
 * Keep in sync with LOCALE_STORAGE_KEY (`rpm-locale`) and detectLocale rules.
 */
const LOCALE_BOOTSTRAP_SCRIPT = `(function(){try{var k='rpm-locale';var s=localStorage.getItem(k);var l=s==='en'||s==='vi'?s:((navigator.language||'').toLowerCase().indexOf('vi')===0?'vi':'en');var r=document.documentElement;r.lang=l;r.dataset.locale=l;}catch(e){document.documentElement.lang='en';}})();`;

/** Blocking inline script — must stay in <head> before body paint. */
export function LocaleScript(): React.JSX.Element {
  return (
    <script
      id="rpm-locale-bootstrap"
      dangerouslySetInnerHTML={{ __html: LOCALE_BOOTSTRAP_SCRIPT }}
    />
  );
}
