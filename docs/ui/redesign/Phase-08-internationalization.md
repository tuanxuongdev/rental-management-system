# Phase-08 — Internationalization

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Master Spec §3 · [`../i18n-implementation.md`](../i18n-implementation.md) · CODING_RULES EN+VI

---

## Goal

Achieve **no user-visible hardcoded UI copy** across redesigned surfaces in English and Vietnamese, with glossary fidelity, lazy-loaded catalogs, persisted locale, and layouts that tolerate ~35% VI expansion.

---

## Scope

**In**

- Catalog expansion by domain namespace (`nav`, `shell`, `auth`, `portfolio`, `finance`, …)
- Locale switcher UX polish (segmented + cycle)
- `html.lang` bootstrap consistency
- Glossary enforcement (Tổ chức, Cư dân, Hợp đồng thuê, Căn/Đơn vị, Giường, …)
- Layout tolerance for longer VI strings (nav, tables, buttons)
- Date/number presentation rules (currency still explicit ISO)
- Fallback to EN for missing VI keys + QA gap report

**Out**

- Translating API problem+json arbitrary server strings (map known codes only)
- URL `[locale]` routing (unless ADR accepted later)
- Inferring currency or tax from locale

---

## Components

I18nProvider · LocaleScript · LocaleSwitcher · `useT` · message catalogs · LocalizedThemeToggle strings

---

## Pages affected

- All redesigned screens from Phases 01–06
- Remaining feature screens brought to zero hardcoded literals as they enter visual QA
- Public auth + staff shell (already partially migrated; complete coverage required)

---

## Acceptance criteria

1. Locale `en` | `vi` persisted (`rpm-locale`); detect browser `vi*` when unset.
2. Lazy load per-locale chunk; switching does not download unused languages eagerly beyond fallback policy.
3. Zero hardcoded user-visible strings on Phase 01–06 golden paths (eslint or checklist gate).
4. VI glossary terms used consistently; no “Room” / org-as-tenant.
5. Nav, table headers, and primary buttons remain usable with 35% longer copy at 390 and 1440.
6. `document.documentElement.lang` matches active locale.
7. Money formatting respects locale **display** but currency code always explicit.
8. Missing-key report empty for golden paths in CI or release checklist.

---

## Estimated effort

**8–12 engineering days** (catalog migration) + **3–5 linguistic review days** (VI)

---

## Dependencies

- i18n runtime exists ([`i18n-implementation.md`](../i18n-implementation.md))
- Phases 01–05 string inventories
- Product glossary owners for finance/legal terms
