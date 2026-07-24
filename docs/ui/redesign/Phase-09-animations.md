# Phase-09 — Animations

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Phases 01–07 · Master Spec §9 · design-system §21

---

## Goal

Apply **subtle, purposeful motion** (150–180 ms core) that signals hierarchy and state changes — Linear/Apple restraint — without slowing desks or violating `prefers-reduced-motion`.

---

## Scope

**In**

- Standard durations: fast 120–150 · normal 150–180 · slow 200–240 (overlays only)
- Enter/exit easings for menus, popovers, modal, drawer
- Theme crossfade already at 180 ms — verify consistency
- Hover/active micro-interactions (opacity/border, optional press scale 0.98)
- Skeleton pulse opacity bounds
- Tab indicator / accordion (if used) motion
- Reduced-motion: instant show/hide everywhere

**Out**

- Page transition libraries that remount shells
- Parallax, confetti, count-up vanity
- Motion that animates width/height layout thrash on tables

---

## Components

Motion tokens in CSS · Overlay enter/exit · Dropdown/Popover · Modal/Drawer · Toast stack · Theme transition · Skeleton pulse · Nav active indicator (optional)

---

## Pages affected

- Global overlays and chrome
- Dashboard widget mount
- Table row selection (avoid large motion)
- Auth card appearance (subtle only)

---

## Acceptance criteria

1. Interactive UI state changes complete in **≤ 180 ms** except overlay enter ≤ 240 ms.
2. Only opacity/transform animated for presence; no large layout dimension animations on data grids.
3. `prefers-reduced-motion: reduce` disables nonessential motion (including theme color tween and skeleton pulse).
4. Focus never trapped by animation; reduced-motion users get immediate UI.
5. Toasts/menus do not jank scroll or shift layout.
6. Motion documented as tokens; features do not hard-code random durations.
7. Perf: no continuous animations on idle dashboards.
8. Design QA signs “calm presence” on modal, drawer, dropdown, theme toggle.

---

## Estimated effort

**3–5 engineering days** + **1 design motion review**

---

## Dependencies

- Stable component APIs from Phases 03–05
- Theme transition hook from Phase-07
- Browser matrix from Phase-06
