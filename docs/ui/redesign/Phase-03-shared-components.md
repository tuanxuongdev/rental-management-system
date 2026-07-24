# Phase-03 — Shared Components

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Master Spec §4–9 · [`../design-system.md`](../design-system.md) §9–14, §18–20

---

## Goal

Bring `@rpm/ui` (and web wrappers) to a **single premium primitive language**: buttons, inputs chrome, badges, cards, dialogs, drawers, toasts, alerts, empty/error shells — so every feature screen inherits commercial quality without one-off CSS.

---

## Scope

**In**

- Button variants/sizes/states (primary near-black, secondary, ghost, danger, link)
- Badge/status (icon + text)
- Card variants (surface, interactive, metric, exception, flat)
- Alert / Toast rules (toast not sole financial evidence)
- Modal / Drawer anatomy, sizes, focus behavior
- Empty / Error / Forbidden state shells
- Tooltip, Dropdown, Pagination chrome
- Icon sizing rules (Lucide outline)
- Token-only styling (no raw hex in features)

**Out**

- Domain-specific form field logic (Phase-04)
- Data-grid behavior (Phase-05)
- Motion timing pass (Phase-09) beyond using motion tokens

---

## Components

Button · Input chrome · Select/Combobox shell · Checkbox/Radio/Switch · Badge · Card · Alert · Toast · Modal · Drawer · Tooltip · Dropdown · Pagination · Skeleton · EmptyState · ErrorState · Tabs · Spinner/Progress

---

## Pages affected

- Indirectly **all** screens consuming `@rpm/ui`
- Highest visual impact: auth cards, admin lists, finance confirmations, portal cards

---

## Acceptance criteria

1. All primitives consume **semantic tokens** only; light & dark AA for text/icons/focus.
2. One primary button per decision region in documented examples.
3. Danger never color-only; toast policy documented in Storybook or UI docs.
4. Modal/Drawer: focus trap, Esc, restore focus, labelled title.
5. Empty/Error shells share anatomy (icon, title, body, one primary action, optional reference id).
6. Radius/shadow/spacing match Master Spec; no `rounded-full` nav pills.
7. Visual regression baselines captured for light/dark.
8. Package boundary: no routes, org state, or domain terms hard-coded inside primitives (labels via props).

---

## Estimated effort

**10–14 engineering days** + **3 design QA days**

---

## Dependencies

- Master Spec color/type/spacing approved
- Existing `packages/ui` inventory ([`design-system-implementation.md`](../design-system-implementation.md)) as starting point
- Theme CSS variables (Phase-07 may refine values; primitives must already bind to semantics)
