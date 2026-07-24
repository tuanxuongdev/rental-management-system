# Theme System Implementation

**Date:** 2026-07-24  
**Spec alignment:** [`design-system.md`](./design-system.md) dark/light tokens  
**Package:** `@rpm/ui` theme module + `apps/web` bootstrap

---

## Capabilities

| Mode | Behavior |
|---|---|
| **Light** | Forces light tokens (`html` without `.dark`) |
| **Dark** | Forces dark tokens (`html.dark`) |
| **System** | Follows `prefers-color-scheme`; updates live when OS theme changes |

Additional:

- Preference persisted in `localStorage` key **`rpm-theme`**
- **No flash** on load via blocking head script
- **Animated** theme switches (180ms) unless `prefers-reduced-motion: reduce`
- Controls in staff top bar (segmented) and public header (cycle)

---

## Architecture

```text
<head>
  ThemeScript          ← applies .dark before paint (localStorage + system)
<body>
  ThemeProvider        ← React state, persist, OS listener, transition class
    ThemeToggle        ← UI to set light | dark | system
```

### DOM contract

| Attribute / class | Meaning |
|---|---|
| `html.dark` | Dark CSS variables active |
| `html.dataset.theme` | Preference: `light` \| `dark` \| `system` |
| `html.dataset.resolvedTheme` | Effective: `light` \| `dark` |
| `html.style.colorScheme` | Native form controls / scrollbars |
| `html.theme-transition` | Temporary class enabling color transitions |

---

## Files

| Path | Role |
|---|---|
| `packages/ui/src/theme/theme.ts` | Types, resolve helpers, `THEME_BOOTSTRAP_SCRIPT` export |
| `packages/ui/src/theme/theme-provider.tsx` | `ThemeProvider`, `useTheme` |
| `packages/ui/src/theme/theme-toggle.tsx` | Segmented + cycle toggles |
| `packages/ui/src/globals.css` | `.theme-transition` rules + reduced-motion |
| `apps/web/src/components/theme/theme-script.tsx` | Head FOUC script (server-safe) |
| `apps/web/src/app/layout.tsx` | Injects `ThemeScript` |
| `apps/web/src/app/providers.tsx` | Wraps app in `ThemeProvider` |
| `apps/web/src/components/layouts/app-shell.tsx` | Staff `ThemeToggle` |
| `apps/web/src/app/(public)/layout.tsx` | Public cycle toggle |

---

## Usage

```tsx
import { ThemeProvider, ThemeToggle, useTheme } from '@rpm/ui';

const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
setTheme('dark');
```

```tsx
<ThemeToggle />              {/* light | dark | system */}
<ThemeToggle variant="cycle" />
```

---

## Persistence

- **Key:** `rpm-theme`
- **Values:** `light` | `dark` | `system`
- **Default:** `system` when missing/invalid
- Not auth-related; safe in `localStorage` (unlike access tokens)

---

## No-flash strategy

1. `ThemeScript` runs synchronously in `<head>` before first paint.
2. Reads `localStorage`, resolves system media query, toggles `.dark`.
3. `suppressHydrationWarning` on `<html>` avoids React mismatch warnings.
4. `ThemeProvider` re-reads on mount without animating the initial sync.

---

## Transitions

On user preference change (and system change while preference is `system`):

1. Add `html.theme-transition` (skipped if reduced motion).
2. Apply new class / variables.
3. Remove transition class after ~220ms.

Animated properties: `background-color`, `border-color`, `color`, `fill`, `stroke`, `box-shadow`, `outline-color` (180ms).

---

## Verification

```bash
pnpm --filter @rpm/ui build
pnpm --filter @rpm/ui lint
pnpm --filter @rpm/web typecheck
```

Manual:

1. Hard-refresh with OS dark → page loads dark without light flash.
2. Switch Light / Dark / System in top bar → persists across reload.
3. Set System + change OS theme → UI updates.
4. Enable reduced motion → switches are instant.

---

## Follow-ups (optional)

- Persist per-Organization preference via settings API
- Command-palette “Toggle theme”
- Storybook matrix for light/dark primitives
