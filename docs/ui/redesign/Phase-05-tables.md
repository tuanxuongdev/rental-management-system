# Phase-05 — Tables

**Parent:** [`../UI_MASTER_SPEC.md`](../UI_MASTER_SPEC.md)  
**Status:** Documentation — ready for design/engineering planning  
**Depends on:** Phase-03 · Master Spec §8.6 · design-system §11

---

## Goal

Deliver a **desk-grade data table system** for invoices, leases, units, arrears, and admin lists: readable density, sticky context, honest empty states, and keyboard-accessible sort/selection — without changing pagination contracts or column business meaning.

---

## Scope

**In**

- Table container (border, radius, overflow)
- Header / row / cell typography and alignment rules
- Comfortable / compact / touch densities
- Toolbar pattern (title+count · search · filters · primary)
- Active filter chips
- Sticky header; optional sticky first column
- Selection + bulk action bar chrome
- Pagination chrome (“Showing x–y of n”)
- Row action menus with accessible names
- List→card transformation hooks for mobile (visual rules)

**Out**

- New columns, sorts, or server query shapes
- Spreadsheet editing features
- Charting

---

## Components

`DataTable` · `TableToolbar` · `FilterChipBar` · `ColumnHeader` (sort) · `RowActionsMenu` · `BulkActionBar` · `Pagination` · `TableEmpty` · `TableSkeleton`

---

## Pages affected

All list/workspace screens, including but not limited to:

- Portfolio: properties, units, beds, owners, agreements, availability
- Residents / waitlist
- Leases
- Finance: payments, invoices, credit notes, deposits, arrears, expenses, meters
- Maintenance / inspections / work orders
- Communications / documents / reports / admin users & audit
- Import/export centers

---

## Acceptance criteria

1. Sentence-case headers; money/dates/numbers right-aligned tabular; status = icon + text.
2. Row heights: 48 comfortable / 40 compact / 52 touch.
3. Hover `--bg-muted`; selected `--accent-soft` (+ checkbox).
4. Empty cells show muted em dash, never blank.
5. Toolbar + chips pattern consistent across domains.
6. Horizontal scroll contained; sticky identity column when required on mobile/tablet.
7. Sortable columns expose `aria-sort`; pagination keyboard operable; result changes announced.
8. Visual QA on finance arrears + units list + users list as golden paths (light/dark).

---

## Estimated effort

**10–14 engineering days** + **3 design/QA days**

---

## Dependencies

- Phase-03 table primitives / pagination
- Phase-01 sticky scope bar behavior on dense pages
- Cursor pagination UX unchanged (API default 25 / max 100)
