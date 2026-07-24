# Phase-04 — Forms

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Phase-03 · Master Spec §8.5 · [`../cross-cutting-patterns.md`](../cross-cutting-patterns.md)

---

## Goal

Make every create/edit/wizard experience feel **precise and trustworthy**: persistent labels, calm validation, money/date correctness, sticky actions, and locale-ready field chrome — without changing validation rules or API payloads.

---

## Scope

**In**

- Form layout templates (single column, section gaps, wizard footer)
- Field anatomy (label, control, hint, error)
- Money field presentation (ISO currency prefix, decimal string, tabular)
- Date/date-time presentation with explicit time zone help
- Error summary + field association (`aria-describedby`)
- Unsaved-change guard visual pattern
- Sticky footer actions on long forms / wizards
- Auth forms visual alignment (login, MFA, invitations)

**Out**

- New fields or business validation
- Changing Zod/API contracts
- Table filters (Phase-05) except shared field chrome

---

## Components

| Component | Spec focus |
|---|---|
| `FormSection` / `Field` | Rhythm 16 / section 24 |
| `MoneyInput` presentation | Currency code + decimal |
| `DateField` / `DateTimeField` | TZ caption |
| `ErrorSummary` | Top-of-form, linked |
| `FormStickyFooter` | Primary/secondary cluster |
| Wizard stepper chrome | Status-bearing steps |
| Combobox entity picker shell | Scope-limited results |

---

## Pages affected

- All create/edit screens under portfolio, residents, leasing, finance, admin, maintenance, communications, documents, reports
- Auth: login, forgot/reset, verify, MFA, invitation accept, org onboarding
- Settings forms (organization settings)

Representative docs: `portfolio/*-create-edit.md`, `leasing/lease-create-wizard.md`, `admin/organization-settings.md`, `auth/*.md`

---

## Acceptance criteria

1. Labels always visible; placeholders never replace labels.
2. Vertical field stack 16 px; section breaks 24 px; form max width ~640 unless workspace exception documented.
3. Money shows explicit ISO currency; never inferred from locale.
4. Errors: corrective copy; linked to fields; preserve input on recoverable failure.
5. High-risk confirms remain dialog/drawer per product rules (visual only).
6. Touch targets ≥ 44 CSS px on mobile; desktop controls ≥ 36 height.
7. EN/VI labels from catalogs; 35% expansion does not break sticky footer.
8. Light/dark focus rings visible on all controls.

---

## Estimated effort

**8–12 engineering days** + **2 design days** (templates + money/date)

---

## Dependencies

- Phase-03 input/button/alert primitives
- i18n catalogs for form strings (Phase-08 completes coverage)
- Existing RHF/Zod patterns unchanged
