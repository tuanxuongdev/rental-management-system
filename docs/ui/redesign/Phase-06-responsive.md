# Phase-06 — Responsive

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Phases 01–05 · Master Spec §7

---

## Goal

Prove **desktop excellence** at 1280–1920 while guaranteeing **full feature access** on 320–414 — no hidden critical workflows, no amputated finance/ops capabilities.

---

## Scope

**In**

- Verification matrix across widths: 320, 375, 390, 414, 768, 1024, 1280, 1440, 1920
- Shell adaptation (bottom nav / More, drawer sidebar, rail)
- Table→card / horizontal scroll rules applied consistently
- Form sticky footers + safe-area
- Drawer full-screen sheets on small viewports
- 200% zoom and 400% reflow checks
- Touch target audit (44 CSS px preferred)

**Out**

- Separate “mobile-only” product
- Removing features below a breakpoint
- Native app builds

---

## Components

Responsive shell adapters · BottomNav · MoreMenu · FullscreenSheet · SafeAreaFooter · ScrollAffinity (table) · CollapsibleFilterPanel

---

## Pages affected

Golden-path audit set (minimum):

- Login / MFA
- Dashboard Home
- Properties list + Property detail
- Units list
- Leases list + Lease detail
- Invoices list + Payment record
- Arrears workspace
- Maintenance request detail
- Resident portal home + payments
- Organization settings

Full inventory remains in [`../README.md`](../README.md); Phase-06 requires a signed checklist covering all domains at 390 and 1440.

---

## Acceptance criteria

1. Every primary staff workflow completable at 390 and 1440.
2. No feature removed; secondary actions may move to overflow/More with accessible labels.
3. Bottom nav covers highest-frequency destinations; context (Org/Property) within one interaction.
4. Tables never drop below readable density — scroll with sticky identity instead.
5. Primary CTAs not covered by OS safe areas or bottom nav.
6. 200% zoom usable; 400% reflow stacks without loss of status/scope.
7. Keyboard and screen reader flows validated on mobile drawer and sheets.
8. Wide 1920 does not stretch forms past max width; dashboard uses space without sparse emptiness.

---

## Estimated effort

**6–9 engineering days** + **3–4 QA days** (device lab / browser matrix)

---

## Dependencies

- Phases 01–05 visually complete on desktop baseline
- Navigation mobile rules in [`../../07-ui-design.md`](../../07-ui-design.md) §5.5
