# Design System Implementation

**Date:** 2026-07-24  
**Spec:** [`docs/ui/design-system.md`](./design-system.md)  
**Package:** `@rpm/ui` (`packages/ui`)  
**Scope:** Tokens + reusable primitives. No API or business-logic changes.

---

## Summary

Design System v2 is implemented as CSS variables + Tailwind semantic aliases + React primitives in `@rpm/ui`. Staff shell and auth surfaces were updated to consume the new components/tokens. Feature screens continue to work via backward-compatible aliases (`background`, `card`, `muted`, `primary`, etc.).

---

## What shipped

### Theme tokens (`packages/ui/src/globals.css`)

| Category | Implementation |
|---|---|
| Colors | Neutral / blue / success / warning / danger / info primitives + semantic `--bg-*`, `--fg-*`, `--border-*`, `--accent*`, `--primary*` |
| Dark mode | `.dark` overrides per spec |
| Typography | `--font-sans`, `--font-mono`; body 14/20 |
| Spacing | `--space-1`…`--space-16` |
| Radius | `--radius-xs`…`--radius-xl` |
| Shadows | `--shadow-xs`…`--shadow-lg`, `--shadow-focus` |
| Borders | `--border-default`, `--border-strong`, `--border-focus` |
| Layout | `--sidebar-width`, `--topbar-height`, `--content-max`, `--form-max` |
| Motion | `prefers-reduced-motion` base rule |
| Compat | Legacy `--background`, `--card`, `--muted`, `--destructive`, `--ring` aliased to v2 tokens |

### TypeScript token helpers (`packages/ui/src/tokens.ts`)

Exports: `spacing`, `radius`, `motion`, `layout`.

### Tailwind (`apps/web/tailwind.config.ts`)

- Colors use `var(--…)` (no HSL wrapper).
- Extended: `canvas`, `surface`, `subtle`, `accent.soft`, `success` / `warning` / `danger` / `info`, radius/shadow/spacing/maxWidth tokens.

### Components (`packages/ui/src/components/*`)

| Component | File | Notes |
|---|---|---|
| Button | `button.tsx` | primary/secondary/outline/ghost/danger/link · sm/md/lg/icon · `loading` |
| Input | `input.tsx` | sizes · `invalid` |
| Label | `label.tsx` | 13px medium |
| Select | `select.tsx` | Native accessible select |
| Checkbox | `checkbox.tsx` | Native |
| Radio / RadioGroup | `radio.tsx` | Native |
| Switch | `switch.tsx` | `role="switch"` |
| Card | `card.tsx` | surface/interactive/metric/exception/flat |
| Badge | `badge.tsx` | neutral/info/success/warning/danger/accent · optional dot |
| Alert | `alert.tsx` | icon + title · status/alert roles |
| Modal | `modal.tsx` | portal · focus/Esc · sizes |
| Drawer | `drawer.tsx` | portal · left/right |
| Tooltip | `tooltip.tsx` | hover/focus · `role="tooltip"` |
| Dropdown | `dropdown.tsx` | menu · keyboard Esc |
| Table | `table.tsx` | Header/Body/Row/Head/Cell · numeric cells |
| Pagination | `pagination.tsx` | Showing X–Y of N |
| EmptyState | `empty-state.tsx` | icon/title/description/actions |
| Skeleton | `skeleton.tsx` | pulse · SkeletonText |
| ErrorState | `error-state.tsx` | title/description/reference/action |

Public exports: `packages/ui/src/index.ts`.

---

## App adoption (non-breaking)

| Surface | Change |
|---|---|
| `app-shell.tsx` | Canvas/sidebar tokens, accent-soft active nav, sentence-case section labels, `Button` for sign-out |
| `(public)/layout.tsx` | Flat canvas (removed decorative gradient) |
| `login/page.tsx` | `Card` composition |
| `login-form.tsx` | `Alert` for errors · `Button loading` |

Feature modules still import `Button` / `Input` / `Label` as before; styles pick up v2 tokens automatically.

---

## How to use

```tsx
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rpm/ui';
```

Ensure app CSS imports `@rpm/ui/globals.css` (existing web entry).

Dark mode: add class `dark` on `html` / root when product enables theme toggle.

---

## Verification

```bash
pnpm --filter @rpm/ui build
pnpm --filter @rpm/ui typecheck
pnpm --filter @rpm/ui lint
pnpm --filter @rpm/web typecheck
```

Completed successfully in this implementation pass.

---

## Out of scope / follow-ups

| Item | Notes |
|---|---|
| Full screen restyle of every feature page | Tokens apply; migrate ad-hoc `rounded-lg border` cards to `Card` incrementally |
| Toast host / provider | Spec ready; no global toast bus yet |
| Sidebar collapse rail | Width tokens present; collapse behavior not wired |
| Combobox / async entity picker | Use `Select` + future combobox; not in this pass |
| Icon package standardization across features | Lucide used in primitives; feature icons migrate as touched |
| Automated visual / a11y regression suite | Recommended next |

---

## File map

```text
packages/ui/src/
  globals.css
  tokens.ts
  index.ts
  lib/utils.ts
  components/
    alert.tsx
    badge.tsx
    button.tsx
    card.tsx
    checkbox.tsx
    drawer.tsx
    dropdown.tsx
    empty-state.tsx
    error-state.tsx
    input.tsx
    label.tsx
    modal.tsx
    pagination.tsx
    radio.tsx
    select.tsx
    skeleton.tsx
    switch.tsx
    table.tsx
    tooltip.tsx
docs/ui/design-system.md              # spec
docs/ui/design-system-implementation.md  # this file
apps/web/tailwind.config.ts           # token wiring
```
