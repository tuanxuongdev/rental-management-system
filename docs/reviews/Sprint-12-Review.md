# Sprint-12 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-12  
**Review date:** 2026-07-24  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-12](../sprints/Sprint-12.md) only — **no Sprint-13** features evaluated or implemented  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [ADR-0004](../adr/0004-money-representation.md) · [06-permission-system.md](../06-permission-system.md) · [04-api-specification.md](../04-api-specification.md) §16–17 · [Sprint-12-Implementation.md](./Sprint-12-Implementation.md) · [reconciliation-tolerance.md](../finance/reconciliation-tolerance.md) · [Sprint-11-Review.md](./Sprint-11-Review.md)

---

## Summary

Sprint-12 delivers the M5 **control plane**: reconciliation runs/items with settlement ingest and tolerance-gated complete, as-of aging buckets, deposit/refund dual-control (identity SoD), payment reversal, accounting period close with open-item gate, parallel billing comparison, finance exports, unapplied-cash ledger (`1200`), and idempotency `begin`/`complete` on high-risk paths. Scope stays inside Sprint-12 (no soak/chaos matrix, expenses, or write-off mega-batch).

This review found **critical** concurrent refund-execute races and recon “fake green” via `SUGGESTED`-as-matched / open-item complete; **high** period holes on webhook settle, idempotency early-exit stuck keys, refund allocation bookkeeping vs later reverse, and SoD UI that only worked in the same browser session. Safe fixes were applied (see Changes Made). Local gates: **lint**, **typecheck**, **unit**, **build**.

**Verdict:** Sprint-12 **Conditional Go** for control-plane staging after applied fixes, provided migration deploy + expanded T12 DB fixtures and finance SME tolerance sign-off. Do **not** claim formal M5 soak (Sprint-13) or full RC until B3 staging evidence and soft B5/B6 gates are addressed.

---

## Critical Issues

### Critical / High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Refund execute | No `FOR UPDATE` on refund row → concurrent execute could double-restore AR/unapplied. | Critical |
| C2 | Recon complete | `SUGGESTED` counted as matched; open `UNMATCHED`/`DISPUTED`/`SUGGESTED` did not block complete within tolerance. | Critical |
| H1 | Refund → reverse | Refund restored invoice balances without marking allocations reversed → later payment reverse double-restored AR. | High |
| H2 | Period close | Webhook `settleFromIntentInTx` skipped `assertPeriodOpen`; period close ignored open recon exceptions. | High |
| H3 | Idempotency | Early `EXECUTED` / `COMPLETED` returns after `begin` left keys stuck `PROCESSING`. | High |
| H4 | MATCH resolve | Accepted any same-org payment id without amount/currency proof. | High |
| H5 | SoD UI | Approve/execute depended on same-session local IDs; unstable Idempotency-Key on money clicks. | High |

### Critical / High (open / deferred)

| ID | Area | Issue | Severity |
|---|---|---|---|
| O1 | Period coverage | Invoice/credit-note/billing-run posts still lack `PeriodService` guards (partial T12-08). | High |
| O2 | Testing | Full DB T12-01..T12-11 fixtures still thin; domain unit gates only for SoD/aging/variance helpers. | High |
| O3 | Payment record/allocate | Not fully migrated to `begin`/`complete` (residual concurrent double-post risk). | High |
| O4 | Payment reversal | Single-actor execute (no approve step) — weaker than refund/disposition SoD. | Medium–High |
| O5 | Custom roles | Dangerous-combination does not hard-reject request+approve+execute triples (identity SoD still blocks same user). | Medium |

---

## Minor Issues

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | Ledger | `TRANSFER` / `REMAINING_HELD` disposition types reduce held without GL lines (document or post). | Medium |
| M2 | UI scope | Recon/periods/exports ignore property shell scope (API supports property filters unevenly). | Medium |
| M3 | Docs drift | Sprint-12.md permission synonyms (`prepare`, `aging.read`, `exports.finance`) vs docs/06 keys (`perform`, `reports.view`, `finance.exports.create`). | Low |
| M4 | A11y | Labels improved in review; no automated WCAG suite (Beta B6). | Low |
| M5 | Exports | Thin sync CSV/JSON; not durable export jobs. | Low |
| M6 | Aging perf | On-read buckets OK for 30–50 rooms; no snapshot table yet. | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | Refund execute locks refund row, re-checks `APPROVED`, locks invoices when restoring |
| H1 | Refund execute marks/splits allocations with `reversedAt` so payment reverse cannot double-restore |
| C2 | Matched totals = `MATCHED` + `EXCEPTION_ACCEPTED` only; open items require approve + override reason |
| H2 | `settleFromIntentInTx` calls `assertPeriodOpen`; period close rejects open recon exceptions |
| H3 | Early executed/completed paths call `idempotency.complete` and return `replayed: true` |
| H4 | MATCH resolve requires payment id + currency/amount within tolerance |
| H5 | SoD UIs accept pasted disposition/refund IDs; stable Idempotency-Key until success; pending disables; control total field; MATCH payment id; periods list requires recon view; export MIME fix; arrears invoice links; labels/`role="status"` |

---

## Remaining Risks

1. **Migration apply** `20260731120000_sprint_12_reconciliation` + expanded integration fixtures required before claiming T12 evidence.
2. **Billing posts in closed periods** still possible until invoice/credit/billing-run wire `PeriodService` (O1).
3. **SME tolerance sign-off** and staging bill→pay→reconcile→age demo (Beta B3) are process gates.
4. **Formal M5 soak** remains Sprint-13.
5. **Soft RC:** mobile (B5), WCAG (B6), privacy stub.
6. **Historical payments** pre-unapplied-cash lack ledger symmetry (forward-only).

---

## Overall Score

**7.4 / 10** (Sprint-12 implementation quality after review fixes)

| Dimension | Score | Notes |
|---|---|---|
| Scope compliance | 8.5 | Control plane in; soak/expenses out |
| Money / SoD correctness | 7.5 | Identity SoD solid after C1/H1; O1/O3 residual |
| Recon integrity | 7.5 | Fake-green closed; MATCH proof added |
| Isolation / RBAC | 8.0 | Org-scoped; PM cannot approve recon |
| UI completeness | 7.0 | Cross-user SoD via ID paste; thin workspaces |
| Tests / evidence | 6.0 | Unit helpers green; DB suite still thin |
| Docs consistency | 7.5 | Implementation + tolerance + runbooks; key synonym drift |

---

## Recommendation

**Conditional Go** to staging control-plane validation and Sprint-13 planning.

**Do not** declare M5 complete or Release Candidate until:

1. Migration deployed and T12-01..11 DB evidence expanded.  
2. Closed-period guards extended to billing invoice/credit posts (O1) or explicitly waived.  
3. Finance SME signs tolerance; staging end-to-end recon demo recorded (B3).  
4. Soft blockers B5/B6 waived or scheduled.

Sprint-13 should focus on sustained soak, webhook chaos, and formal M5 exit without schema rewrite.
