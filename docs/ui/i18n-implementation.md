# Internationalization (i18n) Implementation

**Date:** 2026-07-24  
**Spec alignment:** EN + VI user-visible strings ([`CODING_RULES.md`](../../CODING_RULES.md), FR-LOC-*)  
**Scope:** `apps/web` locale runtime + catalogs

---

## Capabilities

| Item | Behavior |
|---|---|
| **Languages** | English (`en`), Vietnamese (`vi`) |
| **Switcher** | Segmented (staff top bar) and cycle (public header) |
| **Persistence** | `localStorage` key **`rpm-locale`** |
| **Lazy loading** | Dynamic `import()` per locale catalog (separate JS chunk) |
| **Fallback** | Missing `vi` keys fall back to `en` |
| **Document lang** | `html.lang` + `dataset.locale` set before paint |

Canonical glossary (VI): Organization = **Tổ chức**, Resident = **Cư dân**, Lease = **Hợp đồng thuê**, Unit = **Căn/Đơn vị**, Bed = **Giường**, Property Owner = **Chủ sở hữu bất động sản**.

---

## Architecture

```text
<head>
  LocaleScript           ← sets html.lang from localStorage / navigator
<body>
  I18nProvider           ← load catalog, persist, expose t()
    LocaleSwitcher       ← setLocale('en' | 'vi')
    useT() / useI18n()   ← components read strings by key
```

No URL `[locale]` segment — preference is client-persisted (same pattern as theme). Currency is never inferred from locale.

---

## Files

| Path | Role |
|---|---|
| `apps/web/src/i18n/locales.ts` | Locale types, storage key, detect/apply helpers |
| `apps/web/src/i18n/translate.ts` | Lookup, interpolate, `loadMessages` |
| `apps/web/src/i18n/messages/en.ts` | English catalog |
| `apps/web/src/i18n/messages/vi.ts` | Vietnamese catalog |
| `apps/web/src/i18n/i18n-provider.tsx` | `I18nProvider`, `useI18n`, `useT` |
| `apps/web/src/i18n/locale-switcher.tsx` | UI control |
| `apps/web/src/i18n/locale-script.tsx` | Head bootstrap |
| `apps/web/src/app/providers.tsx` | Wraps app in `I18nProvider` |
| `apps/web/src/app/layout.tsx` | Injects `LocaleScript` |

Migrated surfaces (no hardcoded UI copy):

- Staff shell navigation + top bar
- Public header brand + controls
- Auth flows: login, forgot/reset password, MFA, verify email, org onboarding
- Theme toggle labels via `LocalizedThemeToggle`

---

## Usage

```tsx
import { useT, LocaleSwitcher } from '@/i18n';

function Example() {
  const t = useT();
  return (
    <>
      <h1>{t('auth.signInTitle')}</h1>
      <p>{t('theme.cycleAria', { label: t('theme.dark'), resolved: 'dark' })}</p>
      <LocaleSwitcher />
    </>
  );
}
```

### Adding a string

1. Add the key to **both** `messages/en.ts` and `messages/vi.ts` (same tree shape).
2. Replace literals with `t('namespace.key')`.
3. Prefer glossary terms above; never invent Room or “tenant” for residents.

### Namespaces

| Namespace | Contents |
|---|---|
| `common` | Shared labels (product name, email, loading, …) |
| `nav` | Sidebar destinations |
| `shell` | Shell chrome / sections |
| `auth` | Public identity flows |
| `theme` / `locale` | Control a11y strings |

---

## Persistence & detection

1. Read `rpm-locale` (`en` \| `vi`).
2. Else if `navigator.language` starts with `vi` → `vi`.
3. Else → `en`.
4. On switch: write storage, update `html.lang`, lazy-load catalog.

---

## Lazy loading

```ts
await import('./messages/en'); // or vi
```

Only the active locale chunk is downloaded on first paint; switching language fetches the other catalog once.

---

## Verification

```bash
pnpm --filter @rpm/ui build
pnpm --filter @rpm/ui lint
pnpm --filter @rpm/web typecheck
pnpm --filter @rpm/web lint
```

Manual:

1. Open `/login` → switch EN/VI → labels update; reload keeps choice.
2. Staff shell → nav section titles and Sign out translate.
3. `document.documentElement.lang` matches the switcher.
4. With `vi` missing a key (dev), English fallback appears and console warns.

---

## Follow-ups

- Migrate remaining feature screens onto the same catalogs (domain namespaces: `portfolio`, `finance`, …).
- Optional typed key helper (`t('nav.home')` autocomplete).
- Sync user profile `locale` with Organization defaults when account settings land.
- Do not translate API/problem+json codes; map known codes to catalog messages at the edge.
