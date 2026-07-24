# Phase-07 — Theme

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Master Spec §4 · [`../theme-implementation.md`](../theme-implementation.md) · [`../design-system.md`](../design-system.md) §2

---

## Goal

Align Light / Dark / System presentation with the **Master Spec semantic palette** (near-black primary, cool blue accent, slate neutrals), guarantee AA in both resolved themes, and keep FOUC-free, persisted preference behavior.

---

## Scope

**In**

- Token value audit vs Master Spec (light + dark tables)
- Primary vs accent separation (CTA ≠ link blue)
- Focus, selection, hover, disabled token completeness
- Theme toggle labels/placement consistency in shells
- 180 ms theme transition policy + reduced-motion
- Overlay/scrim and shadow adjustments for dark
- Documentation of any CSS variable renames (compat notes)

**Out**

- New theme engines or third themes
- Per-Organization branded themes (future)
- Changing persistence key without migration note

---

## Components

ThemeProvider · ThemeScript · ThemeToggle / LocalizedThemeToggle · CSS `:root` / `.dark` maps · `theme-transition` utility

---

## Pages affected

- Global (all routes)
- High scrutiny: dashboard, finance tables, auth cards, modals/drawers, charts

---

## Acceptance criteria

1. Light and Dark token tables match Master Spec §4 (hex audit).
2. System mode tracks OS and updates live; preference persisted (`rpm-theme`).
3. No flash of wrong theme on hard reload (blocking script).
4. Body text ≥ 4.5:1; focus ring ≥ 3:1; status badges AA in both themes.
5. Primary CTA remains near-black (light) / near-white (dark); accent reserved for focus/links/selection.
6. Theme transition ≤ 180 ms; reduced-motion disables color animation.
7. Toggle present on staff and public chrome; accessible name localized.
8. Charts and semantic soft backgrounds re-verified in dark.

---

## Estimated effort

**4–6 engineering days** + **2 a11y contrast days**

---

## Dependencies

- Phases 01–03 consuming semantic tokens (not hard-coded hex)
- Existing theme runtime ([`theme-implementation.md`](../theme-implementation.md))
- Design sign-off on dark sidebar/table header values
