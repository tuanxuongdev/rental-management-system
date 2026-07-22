# Sprint-10 — Billing Foundation

**Sprint ID:** Sprint-10  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 10 · Phase 5 start toward **M5**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [01-business-requirements.md](../01-business-requirements.md)  
**UI references:** [ui/finance/billing-run-workspace.md](../ui/finance/billing-run-workspace.md) · [ui/finance/invoices-list.md](../ui/finance/invoices-list.md) · [ui/finance/invoice-detail.md](../ui/finance/invoice-detail.md) · [ui/finance/meter-reading-grid.md](../ui/finance/meter-reading-grid.md) · [ui/finance/utility-allocation-run.md](../ui/finance/utility-allocation-run.md) · [ui/finance/deposits-list.md](../ui/finance/deposits-list.md) · [ui/finance/credit-notes-list.md](../ui/finance/credit-notes-list.md) · [ui/shell/operations-center.md](../ui/shell/operations-center.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks  
**Status:** Ready for planning  
**Builds on:** [Sprint-09.md](./Sprint-09.md)

---

## Goal

Finalize monetary policy in product behavior and deliver charge schedules, one-off charges, invoices/statements, ledger entries, deposit records, MVP meters/utility allocation, and idempotent billing runs with preview/approval so a billing run produces deterministic, reviewable charges without duplicates.

---

## Business Value

- First revenue automation: recurring rent and services become system-generated.
- Creates the authoritative ledger payments (Sprint-11) must allocate against.
- De-risks month-start concurrency and timezone/rounding errors before money movement.
- Independently deployable: invoices and ledgers ship without PSP settlement (balances due visible; collection in Sprint-11).

---

## Scope

### In scope

- Enforce approved ADRs: money (`NUMERIC(19,4)`), rounding, timezone, due-date, tax **display** (no statutory filing), invoice numbering (completes policy started in Sprint-08 storage ADR).
- `billing_schedules`, `charge_rules`, `service_catalog_items`, `lease_services`.
- One-off charges; recurring schedule generation.
- `invoices`, `invoice_lines`, `invoice_status_history`, `credit_notes`, `credit_note_lines`.
- `ledger_accounts`, `ledger_entries`, `balance_snapshots` (thin), `opening_balance_entries` (import-ready stubs OK).
- **Canonical** `security_deposits` posted from lease terms / activation; disposition execution remains Sprint-12 (Sprint-09 checklist only).
- `late_fee_policies` model + optional preview (full late-fee batch thin/stretch).
- **Canonical** `meters`, `meter_readings`, `tariffs`, `utility_allocation_runs` at MVP depth—**timeboxed**: if capacity slips, ship rent billing first and keep utility allocation as stretch with feature flag.
- Billing-run workspace: scope, period, preview, approval, async commit, advisory lock per `(tenant_id, schedule_id, period)`.
- Run identity via `scheduled_jobs` + Operations Center / async operations resource (do **not** invent an undocumented parallel job store; additive correlation fields OK).
- Worker idempotent generation via outbox; Operations Center job tracking.
- Finance navigation: invoices, billing run, meters/utilities, deposits list.
- Backfill: optional migration of Sprint-09 checklist reading values into `meter_readings` when meters exist.

### Out of scope

- PSP / online payments and webhooks (Sprint-11).
- Cash/bank recording UI depth (Sprint-11).
- Reconciliation and aging desk (Sprint-12).
- Expenses module (API may exist in spec; not in Sprint-01–12 pack—backlog after M5/M6).
- Payment plans / promise-to-pay (Post-GA Phase 2).
- Owner distribution accounting.

---

## Features

1. Charge schedules bound to activated/moved-in leases.
2. Billing-run preview with totals and prior-period comparison.
3. Async billing commit with durable run id; failed-item retry.
4. Invoice list/detail with lines, status history, currency, dates.
5. Ledger entries for each posted charge/invoice effect.
6. Meter reading grid + utility allocation run (MVP).
7. Deposits list from lease obligations.
8. Credit note / adjustment path for corrections.
9. Month-boundary, leap-date, timezone, retry, proration tests.

---

## User Stories

1. **As an Accountant**, I can preview a monthly billing run and see exactly which leases will be charged before commit.
2. **As an Accountant**, committing a billing run twice for the same period does not duplicate charges.
3. **As a Property Manager**, I can enter meter readings in a keyboard-efficient grid so utilities can be allocated.
4. **As an Accountant**, I can open an invoice and see lines, due date, currency, and status history.
5. **As an Organization Administrator**, I cannot delete posted invoice lines—only reverse/adjust—so auditability holds.
6. **As a product owner**, demo shows deterministic charges for a sample portfolio after kill/retry of the worker.

---

## Database Changes

| Table | Purpose |
|---|---|
| `service_catalog_items` | Billable services |
| `lease_services` | Services on leases |
| `billing_schedules` | Schedules |
| `charge_rules` | Rule versions |
| `late_fee_policies` | Late fee config |
| `meters` / `meter_readings` / `tariffs` | Utilities |
| `utility_allocation_runs` | Allocation batches |
| `invoices` / `invoice_lines` / `invoice_status_history` | Invoices |
| `credit_notes` (+ lines if modeled) | Corrections |
| `ledger_accounts` / `ledger_entries` | Ledger |
| `opening_balance_entries` | Migration-ready |
| `balance_snapshots` | Snapshot support |
| `security_deposits` | Deposit obligations (**canonical owner: this sprint**) |
| Billing run correlation | `scheduled_jobs` + operations/idempotency metadata; advisory locks |

**Locks:** Advisory locks for billing runs; unique idempotency for `(tenant_id, lease_id, period, charge_key)` as designed.

---

## API Changes

Subset of API §15–16 (meters, invoices, billing):

| Area | Endpoints (representative) |
|---|---|
| Schedules / charges | CRUD + generate preview |
| Billing runs | create, preview, approve, commit, get status, retry failed |
| Invoices | list/detail, void/reverse via credit note |
| Ledger | read entries/balances |
| Deposits | list/detail |
| Meters/readings | CRUD, bulk upsert draft/commit |
| Utility allocation | preview/commit run |

**Rules:** `Idempotency-Key` on commit; currency on every amount; `If-Match` on updates; org isolation; async operations in Operations Center.

---

## UI Changes

| Screen | Spec |
|---|---|
| Billing run workspace | `ui/finance/billing-run-workspace.md` |
| Invoices list/detail | `ui/finance/invoices-list.md`, `invoice-detail.md` |
| Meter reading grid | `ui/finance/meter-reading-grid.md` |
| Utility allocation | `ui/finance/utility-allocation-run.md` |
| Deposits list | `ui/finance/deposits-list.md` |
| Credit notes list | `ui/finance/credit-notes-list.md` |
| Navigation | Add **Finance** |
| Operations Center | Billing/utility jobs |

Show as-of/freshness, currency, accounting date vs transaction date. High-risk batch commit confirmation.

---

## Permissions

| Permission | Use |
|---|---|
| `finance.charges.*` | One-off / schedule edits |
| `finance.invoices.read` | View |
| `finance.billing_run.preview/commit` | Batch (SoD: committer ≠ sole unchecked if policy) |
| `finance.deposits.read` | Deposits |
| `finance.credit_notes.*` | Adjustments |
| `meters.*` / `utilities.allocate` | Utilities |
| Property scope | Filter finance by grant where applicable |

Accountant role primary; Property Manager limited invoice view if granted.

---

## Validation Rules

1. No float money; currency required; incompatible currencies never summed silently.
2. Billing period + schedule unique commit; advisory lock held for duration.
3. Preview is read-only; commit idempotent.
4. Proration and partial periods follow ADR; leap/DST tested.
5. Posted lines immutable; corrections via credit note/reversal.
6. Invoice numbering monotonic per org policy.
7. Utility allocation explainable (inputs, formula version, outputs).
8. Meter commit online-only; no blind offline replay of committed rows.
9. Deposit amount matches lease currency.
10. Failed run retains successful items; retry failed-only when safe.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T10-01 | Preview billing run | Totals + line samples; no writes |
| T10-02 | Commit run | Invoices + ledger; job completed |
| T10-03 | Re-commit same period/key | No duplicates |
| T10-04 | Concurrent two commits same period | One wins; other conflict |
| T10-05 | Worker kill mid-run | Resume; deterministic |
| T10-06 | Timezone/month boundary | Per ADR |
| T10-07 | Proration partial occupancy | Expected amount |
| T10-08 | Credit note reverses charge | Ledger balanced |
| T10-09 | Meter grid + allocation | Charges linked with evidence |
| T10-10 | Cross-org invoice id | 404 |
| T10-11 | Isolation suite finance read/write | Pass |
| T10-12 | Delete posted invoice attempt | Rejected |

---

## Acceptance Criteria

1. A billing run produces deterministic, reviewable charges without duplicates (**Sprint 10 demo**).
2. Invoices, ledger entries, and deposit records exist for activated leases in sample data.
3. MVP meters/utility allocation usable for boarding-house scenario **or** explicitly flagged stretch with rent-only billing accepted by finance SME.
4. Money/timezone/numbering ADRs reflected in behavior and tests.
5. Async billing visible in Operations Center with durable run id.
6. Deployed to staging; finance SME reviews preview UX.
7. Sprint-11 can allocate payments to invoice balances without ledger redesign.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Utility + billing together | Sprint overload / weak billing | Timebox utilities; feature-flag allocation; rent path is must-hit |
| Wrong rounding/TZ | Systemic under/overcharge | ADR + boundary tests |
| Duplicate month-start charges | Trust loss | Locks + idempotency keys |
| Utility disputes | Support load | Explainability + evidence |
| Scope into payments | Slip | Strict out-of-scope |
| PSP KYC still pending | OK for this sprint | Parallel track for Sprint-11 |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-09 leases/occupancy/terms | Hard | Yes |
| Money/tax/TZ/numbering ADR (billing policy) | Hard | Completes Sprint-08 storage ADR |
| Finance SME | Hard | Preview sign-off |
| Sprint-02 outbox/worker | Hard | Yes |
| Sprint-11 | Downstream | Payments against invoices |

---

## Deliverables

1. Billing/invoice/ledger/deposit/meter migrations.
2. Billing-run APIs + worker.
3. Finance UI (billing run, invoices, meters, deposits, credit notes).
4. Determinism/concurrency test pack.
5. Runbook draft: billing replay / failed-run retry.
6. Staging demo dataset with posted invoices.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Schema + ledger + deposits domain | 3 days |
| Billing run worker + locks | 3 days |
| Meters/utilities MVP (timeboxed) | 1–2 days |
| Finance UI | 2 days |
| Tests + SME review | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |
| **Capacity note** | If utilities slip, do not extend sprint—flag stretch and protect rent billing demo |

Named senior owns billing correctness.

---

## Definition of Done

1. Acceptance criteria met; duplicate-free demo recorded.
2. Billing replay/retry notes updated; tests assert idempotency.
3. Coding standards, CI, isolation tests pass.
4. No critical/high billing defects open.
5. Independently deployable without PSP.
6. Handoff: Sprint-11 payment allocation to open balances.
