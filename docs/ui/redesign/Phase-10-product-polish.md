# Phase-10 — Product Polish

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Phases 01–09 complete · screen inventory [`../README.md`](../README.md)

---

## Goal

Ship a **release-candidate visual quality gate**: consistency sweep, empty/error copy audit, density tuning, accessibility sign-off, and commercial first-impression readiness across staff, portal, platform, and auth.

---

## Scope

**In**

- Cross-surface visual consistency audit (radius, borders, typography, icon sizes)
- Empty / error / forbidden copy tone pass (EN + VI)
- Density defaults (comfortable vs compact finance) documented and applied
- First-run / onboarding aesthetic alignment
- Favicon/OS theme-color / social-neutral metadata (if in-product)
- Keyboard shortcut hints (search ⌘K) visibility rules
- Final WCAG 2.2 AA audit light+dark
- Regression baselines + redesign exit checklist
- Update screen specs only where visuals diverge from old screenshots/descriptions (docs)

**Out**

- New features or workflow changes
- Performance backend work
- Marketing website redesign

---

## Components

No new primitives required; polish existing. Optional: `CommandPalette` chrome alignment, help menu affordances.

---

## Pages affected

- Full inventory in [`../README.md`](../README.md)
- Explicit sign-off list: auth suite, dashboard, properties, units, leases, invoices, payments, arrears, residents, maintenance, admin users/roles/settings, portal home/payments, platform dashboard

---

## Acceptance criteria

1. Master Spec Do/Don’t checklist passes on golden paths.
2. No Bootstrap/Material/Ant/AdminLTE residual patterns in chrome or tables.
3. EN/VI complete for all user-visible strings on signed-off pages; glossary clean.
4. Light / Dark / System verified; AA contrast report attached.
5. Responsive matrix (Phase-06) re-run green after polish diffs.
6. Motion reduced-motion verified; theme/locale persistence verified.
7. Financial surfaces always show currency + as-of/scope where required.
8. Product/design/FE/QA **Go** on redesign exit checklist; open issues severity-triaged (no Sev-1 visual/a11y).

---

## Estimated effort

**5–8 engineering days** + **4–6 design/QA/linguistic days**

---

## Dependencies

- Phases 01–09 acceptance criteria met
- Test accounts for roles: Owner, Admin, Property Manager, Accountant, Auditor, Resident, Platform support
- Freeze on unrelated visual drive-bys during gate
