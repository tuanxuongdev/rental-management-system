# Sprint-10 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-10  
**Review date:** 2026-07-24  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-10](../sprints/Sprint-10.md) only — **no Sprint-11** features evaluated or implemented  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [ADR-0004](../adr/0004-money-representation.md) · [ADR-0006](../adr/0006-billing-policy.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [Sprint-10-Implementation.md](./Sprint-10-Implementation.md) · [Alpha-Product-Review.md](./Alpha-Product-Review.md)

---

## Summary

Sprint-10 delivers the billing foundation required for M5 start: ADR-0006 money/period/numbering policy, billing schedules and charge rules, billing-run preview/approve/commit with advisory locks, posted invoices + ledger journals, canonical `security_deposits` on lease activate, MVP meters/utility allocation (flagged), credit notes, Finance navigation/UI, Operations Center `BILLING_RUN` rows, and an Accountant role activation. **Payment collection / PSP remains correctly out of scope (Sprint-11).** Reports beyond thin ledger reads and invoice lists are not a Sprint-10 deliverable (aging/recon = Sprint-12).

This review found **critical** money/concurrency and UX defects: concurrent credit-note over-crediting, missing durable charge-key uniqueness, utility commit races, and a broken web preview missing `If-Match`. **High** gaps included commit without approval, preview schedule side effects, silent multi-currency skips, unlocked invoice sequences, non-transactional meter bulk, void UI permission mismatch, missing ledger list API, and property-scope gaps on billing-run lists.

Safe in-repo fixes were applied in this session (see Changes Made). Local gates pass: **lint**, **typecheck**, **unit**, **build**. Integration T10-* remain DB-gated. Async worker still acknowledges rather than fully generating under kill/resume (documented residual). Property-zone proration and full T10-04/05/06/07 evidence remain open for soak/SME.

**Verdict:** Sprint-10 **meets Conditional Go toward Sprint-11 payments**, provided staging migration + finance SME preview sign-off and known residuals are tracked. Do **not** claim M5 / Beta until payments + recon soak land.

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Credit notes | Concurrent CN posts could over-credit AR (balance check without invoice row lock). | Critical |
| C2 | Charge identity | No durable unique `(tenant, charge_key)` — ADR-0006 posting key not DB-enforced; `rent:{period}` collided across leases. | Critical |
| C3 | Utilities | Utility allocation commit raced without period advisory lock / unique charge keys. | Critical |
| C4 | Web / API | Billing preview UI omitted required `If-Match`; auto-query POST could never succeed (428). | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Billing SoD | Commit accepted `PREVIEWED` (approval optional server-side). | High |
| H2 | Preview purity | Preview path could create schedules/charge rules (`ensureSchedules` in preview build). | High |
| H3 | Currency | Multi-currency leases were silently skipped from preview totals. | High |
| H4 | Numbering | Invoice/CN sequence used unlocked read-modify-write on `tenant_settings`. | High |
| H5 | Meters | `ATOMIC` bulk readings used `this.prisma` inside `$transaction` (not transactional). | High |
| H6 | Invoice UI | Void gated on `invoices.issue` instead of `charges.void`; weak confirmation. | High |
| H7 | API gap | Ledger list path in contracts had no controller. | High |
| H8 | Isolation | Billing-run list lacked property-scope filtering. | High |
| H9 | Deposits | Re-ensure could rewrite `amountDue` on non-`DUE` (e.g. HELD) deposits. | High |
| H10 | Void safety | Void lacked invoice lock / posted-CN guard (paired with C1). | High |

---

## Minor Issues

### Medium (open / deferred)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | Async commit | Worker handler is idempotent status ack; generation is sync in API — T10-05 kill/resume not fully evidenced. | Medium |
| M2 | Proration / TZ | ADR-0006 daily proration + property TZ charge windows not fully applied in rent generation (UTC-centric UI remains). | Medium |
| M3 | Testing | T10-04 concurrent commit, T10-06/07 TZ/proration, T10-11 finance isolation suite incomplete / DB-gated. | Medium |
| M4 | Utilities depth | Equal-split MVP largely ignores meter consumption evidence (flag on; SME may keep stretch). | Medium |
| M5 | BillingRun unique | Nullable `scheduleId` unique allows multiple NULL-schedule runs per period in Postgres. | Medium |
| M6 | Advisory lock | `hashtext` 32-bit collision residual; lock key omits schedule id. | Medium |
| M7 | RBAC | Accountant lacks meter create / utilities.allocate (Owner/Admin have via full catalog). | Medium |
| M8 | A11y | Labels/alerts present; no automated WCAG suite. | Medium |
| M9 | Process | Staging demo dataset + finance SME preview sign-off not evidenced here. | Medium |
| M10 | Late fees | Policy table only; no batch assessment UI (accepted stretch). | Medium |

### Low

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | Idempotency | Create billing-run client may send Idempotency-Key while create ignores it. | Low |
| L2 | Semantics | Full credit zeroes balance → status `PAID` (credited-by-CN; document for Sprint-11). | Low |
| L3 | Dashboard | Home is leasing exceptions + finance note; no finance KPIs (expected until Sprint-12 reports). | Low |
| L4 | Reports | No aging/recon reports (out of Sprint-10; thin ledger list only). | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 / H10 | Credit-note post and invoice void take `SELECT … FOR UPDATE` on invoice; void blocked when posted CNs exist |
| C2 | `rentChargeKey(leaseId, periodKey)`; unique index `invoice_lines (tenant_id, charge_key)` migration `20260729130000_sprint_10_review_charge_unique` |
| C3 | Utility commit uses billing period advisory lock + lease-scoped utility charge keys |
| C4 | Web preview sends `If-Match` version; workspace uses explicit preview mutation (no broken auto POST) |
| H1 | Commit requires `APPROVED` (retry allows `FAILED`/`PARTIAL` only) |
| H2 | `ensureSchedulesForScope` only on create + commit (not preview build) |
| H3 | Currency mismatch fails with `CURRENCY_MISMATCH` |
| H4 | Sequence allocation locks `tenant_settings` row `FOR UPDATE` |
| H5 | Meter bulk ATOMIC uses transaction client for upserts |
| H6 | Void UI uses `finance.charges.void`, POSTED-only, confirm checkbox |
| H7 | `LedgerController` + `listLedgerEntries` |
| H8 | Billing-run list filters by accessible properties |
| H9 | Deposit ensure does not rewrite non-`DUE` amounts |
| UX | Approve only when `PREVIEWED`; commit only when `APPROVED` + confirmation |
| Tests | Rules unit tests updated for lease-scoped rent charge keys |

---

## Verification matrix

| Criterion | Status | Notes |
|---|---|---|---|
| Sprint scope (no Sprint-11 payments) | ✅ Pass | No PSP/cash payment modules |
| Finance / billing workflow | ✅ Pass (post-fix) | Preview → approve → commit → invoices/ledger |
| Payment workflow | ✅ N/A (Sprint-11) | Explicitly deferred |
| Dashboard | ⚠️ Partial | Home finance note + Finance nav; not finance ops desk |
| Reports | ⚠️ Partial | Invoice/ledger lists only; aging/recon later |
| Database consistency | ✅ Pass (post-fix) | ADR money; charge unique; deposits |
| API consistency | ✅ Pass (post-fix) | Org paths; If-Match; Idempotency on commit/post; ledger list |
| UI consistency | ✅ Pass (post-fix) | Finance nav; billing workspace gates fixed |
| Security / RBAC | ✅ Pass (post-fix) | Permissions on controllers; Accountant ACTIVE; property scope improved |
| Multi-tenant isolation | ✅ Pass | `tenantId` filters; T10-10 authored |
| Performance | ✅ Pass | Caps/cursors; advisory lock for month-start |
| Error handling / validation | ✅ Pass (post-fix) | Currency, approval, version, CN balance |
| Accessibility | ⚠️ Partial | Basic roles; no automated a11y |
| Testing | ⚠️ Partial | Unit + contracts pass; T10 integration DB-gated; concurrency/TZ gaps |
| Documentation consistency | ✅ Pass | Implementation + runbook + ADR-0006 |

---

## Remaining Risks

1. **Sprint-11 dependency** — balances are visible but uncollectible in-product until payments land.
2. **Async/resume story** — worker does not fully own generation; month-start kill/resume needs staging proof or worker expand.
3. **Proration / property TZ** — under/over-charge risk for partial occupancy until ADR-0006 daily formula is enforced in generation.
4. **Nullable schedule uniqueness** — multiple org-wide runs per period still possible at DB level.
5. **Integration evidence** — apply migrations and run T10-* / isolation before calling DoD complete.
6. **Existing orgs** — Accountant/finance permissions require RBAC re-seed/assign after catalog change.
7. **Utility MVP** — equal-split without reading evidence may drive disputes; keep flag/SME waiver explicit.

---

## Overall Score

| Dimension | Score | Notes |
|---|---:|---|
| Sprint scope compliance | **9.0 / 10** | Clean Sprint-11 boundary |
| Billing / finance workflow | **8.0 / 10** | Solid post-fix; async/proration residuals |
| Money / concurrency correctness | **8.0 / 10** | Locks + unique keys added; soak tests pending |
| Security / isolation / RBAC | **8.0 / 10** | Controllers + Accountant; meter SoD incomplete |
| API / DB / UI consistency | **8.5 / 10** | Preview/ledger/UI gates fixed |
| Tests / evidence | **6.5 / 10** | Unit strong; integration/concurrency DB-gated |
| Docs consistency | **8.5 / 10** | ADR-0006 + runbook + implementation aligned |

**Overall Sprint-10 review score: 8.0 / 10**

---

## Recommendation

**Conditional Go → Sprint-11 (payments against open invoice balances).**

Do **not** implement Sprint-11 in this review. Before claiming Sprint-10 DoD closed: apply both Sprint-10 migrations on staging, run T10 integration/isolation, complete finance SME preview UX sign-off, and track proration/async residuals. Independently deployable without PSP remains true: invoices and ledger exist for payment allocation handoff.
