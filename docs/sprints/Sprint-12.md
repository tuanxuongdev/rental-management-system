# Sprint-12 — Reconciliation and Financial Controls

**Sprint ID:** Sprint-12  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 12 · Phase 5 · **M5 control-plane exit** (sustained soak = roadmap Sprint 13; sprint file not yet in this pack)  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md)  
**UI references:** [ui/finance/reconciliation-workspace.md](../ui/finance/reconciliation-workspace.md) · [ui/finance/arrears-workspace.md](../ui/finance/arrears-workspace.md) · [ui/finance/deposit-disposition.md](../ui/finance/deposit-disposition.md) · [ui/finance/payment-detail.md](../ui/finance/payment-detail.md) · [ui/admin/export-center.md](../ui/admin/export-center.md) · [ui/cross-cutting-patterns.md](../ui/cross-cutting-patterns.md)  
**Duration:** 2 weeks (program calendar: weeks 23–24 from Sprint-01 start; does **not** end GA)  
**Status:** Ready for planning  
**Builds on:** [Sprint-10.md](./Sprint-10.md) · [Sprint-11.md](./Sprint-11.md)

---

## Goal

Deliver settlement reconciliation, unmatched-item queues, aging/outstanding balances, correction/reversal controls, deposit disposition execution with dual-control, and parallel billing comparison tooling so totals reconcile within an agreed documented tolerance and exceptions are explainable—satisfying the **roadmap Sprint 12 / M5 control-plane exit**. Sustained financial soak and replay remain roadmap Sprint 13.

---

## Business Value

- Makes collected money trustworthy: provider settlements match internal ledger.
- Gives operators an arrears/aging view for collections follow-up.
- Closes deposit disposition left pending since move-out (Sprint-09) with SoD.
- Independently deployable control plane on top of billing/payments; sustained soak is the next sprint’s marathon, not a blocker to shipping recon.

---

## Scope

### In scope

- `reconciliation_runs`, `reconciliation_items` (matched, unmatched, disputed).
- Import or ingest provider settlement reports / webhook settlement events.
- Exception queue workflow: assign, note, resolve, write-off handoff.
- Aging buckets with explicit as-of date and currency.
- Outstanding balance and collection status views; basic arrears workspace.
- Correction/reversal controls for payments and invoices (policy-gated).
- Closed-period or finalized-record protection per agreed policy.
- Deposit disposition execution: deduct/refund/forfeit/transfer checklist → ledger effects with dual-control above thresholds.
- Refund approve/execute SoD where pending from Sprint-11.
- Parallel/historical billing comparison against approved source samples (tooling + report).
- Daily reconciliation and payment-incident runbooks completed.
- Governed finance export hooks (aging/payments) with authz.

### Out of scope

- Multi-week financial soak chaos matrix (roadmap Sprint 13; **no Sprint-13.md in this pack yet**—track as backlog).
- Payment plans automation.
- Expenses module (deferred beyond Sprint-12 pack).
- Full GL / owner distributions.
- Advanced collections sequences / SMS (Phase 2).
- Write-off mega-batch without dual-control (must include SoD if shipped).
- Maintenance, notifications, dashboards/reports (roadmap Sprints 14–15 / **M6**—out of this pack).

---

## Features

1. Reconciliation workspace: run, match suggestions, exception queue.
2. Aging / arrears workspace with as-of and buckets.
3. Deposit disposition UI completing move-out finance.
4. Refund approval/execution dual-control flow.
5. Reversal/correction actions with reason and audit.
6. Parallel run comparison report (internal vs source totals).
7. Period close / lock flag (MVP).
8. Runbooks: daily recon, payment incidents, exception SLA.

---

## User Stories

1. **As an Accountant**, I can run reconciliation for a day/period and see matched vs unmatched provider items.
2. **As an Accountant**, I can resolve an unmatched payment with a reason so exceptions do not linger silently.
3. **As an Accountant**, I can view aging buckets as-of a date to prioritize collections.
4. **As an Organization Owner**, large refunds and deposit releases require a second approver so no single actor can drain funds.
5. **As a Property Manager**, I can see arrears for my properties without accessing recon approval.
6. **As a finance SME**, parallel comparison shows variances within agreed tolerance or explained exceptions.
7. **As a product owner**, demo shows end-to-end: invoice → pay → settle → reconcile → aging update.

---

## Database Changes

| Table | Purpose |
|---|---|
| `reconciliation_runs` | Run header |
| `reconciliation_items` | Line matches/exceptions |
| `security_deposit_disposition_lines` | Disposition execution lines |
| Refund status columns | approve/execute actors, timestamps |
| Aging materialization (optional) | Snapshot table or on-read aggregation with perf plan |
| Period lock | `accounting_periods` or settings flags |
| Write-offs (if in MVP) | Controlled write-off records |

All org-scoped; audit on approve/execute/resolve.

---

## API Changes

| Area | Endpoints (representative) |
|---|---|
| Reconciliation | create run, list items, match, resolve, complete |
| Settlements | ingest/import settlement file or fetch job |
| Aging | `GET .../aging?asOf=&currency=` |
| Arrears | list accounts with buckets/filters |
| Deposit disposition | preview, request, approve, execute |
| Refunds | approve, execute |
| Reversals | payment/invoice correction endpoints |
| Period | close/reopen (reopen restricted) |
| Exports | aging/payments export job |

**Rules:** Dual-control: requester ≠ approver ≠ executor when policy requires; `Idempotency-Key` on execute; step-up for high-risk; org isolation.

---

## UI Changes

| Screen | Spec |
|---|---|
| Reconciliation workspace | `ui/finance/reconciliation-workspace.md` |
| Arrears workspace | `ui/finance/arrears-workspace.md` |
| Deposit disposition | `ui/finance/deposit-disposition.md` |
| Payment/refund detail | Approval panel |
| Export center (finance) | `ui/admin/export-center.md` subset |
| Invoice/payment | Correction actions |

High-risk confirmation sequence; show approver identity; currency and as-of everywhere; no delete of posted money.

---

## Permissions

| Permission | Use |
|---|---|
| `finance.reconciliation.prepare` | Create/match |
| `finance.reconciliation.approve` | Complete/approve run |
| `finance.aging.read` | Aging/arrears |
| `finance.deposit_disposition.request/approve/execute` | SoD split |
| `finance.refunds.approve/execute` | SoD split |
| `finance.write_offs.*` | If enabled |
| `finance.period.close` | Period lock |
| `exports.finance` | Exports |

Custom roles cannot combine request+approve+execute for the same money action.

---

## Validation Rules

1. Reconciliation variance outside tolerance cannot “force complete” without documented override permission + reason.
2. Unmatched items require resolution code before period close (policy).
3. Aging as-of is a date-only business date (no TZ shift).
4. Dual-control identity separation enforced server-side.
5. Deposit disposition lines sum correctly; cannot over-dispose.
6. Refund execute ≤ approved amount; currency match.
7. Corrections require reason; link to original immutable records.
8. Closed period rejects new posts except controlled adjustment types.
9. Exports respect property scope and PII rules.
10. Parallel comparison outputs machine-readable variance list.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T12-01 | Recon run matches settlement | Items matched; run completable |
| T12-02 | Unmatched item resolve | Audited; queue updated |
| T12-03 | Force-complete over tolerance without perm | Rejected |
| T12-04 | Aging as-of buckets | Correct classification |
| T12-05 | Deposit disposition SoD | Requester cannot approve |
| T12-06 | Refund approve≠execute same user when required | Rejected |
| T12-07 | Payment reversal | Ledger balanced; original retained |
| T12-08 | Closed period post | Rejected |
| T12-09 | Parallel comparison within tolerance | Pass report |
| T12-10 | Cross-org recon id | 404 |
| T12-11 | Property Manager cannot approve recon | Denied |
| T12-12 | Isolation suite recon/disposition | Pass |

---

## Acceptance Criteria

1. Totals reconcile within an agreed, documented tolerance and exceptions are explainable (**roadmap Sprint 12 exit / M5 control plane**).
2. Reconciliation workspace and exception queue are usable by Accountants on staging.
3. Aging/arrears views show as-of buckets and currency.
4. Deposit disposition and refund dual-control execute ledger-safe outcomes.
5. Correction/reversal controls replace destructive edits.
6. Daily reconciliation and payment-incident runbooks published.
7. Parallel billing comparison tooling available for pilot finance review.
8. Deployed to staging; finance SME signs tolerance document.
9. Hand-off ready for roadmap Sprint 13 soak without schema rewrite.

**M5 completeness:** This sprint satisfies the **Sprint 12** roadmap exit. Formal **M5 soak** (“no unexplained duplicate/missing/imbalanced transaction” under sustained chaos) remains **roadmap Sprint 13** and must be authored as `Sprint-13.md` before claiming Phase 5 closed.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Vague tolerance | Fake green recon | Pre-agree numeric tolerance with finance |
| SoD bypass via dual roles | Fraud | Server checks on identity, not role labels alone |
| Settlement format churn | Broken ingest | Adapter per provider; version fixtures |
| Aging performance at 10k | Unusable desk | Indexes / snapshot strategy |
| Scope soak into this sprint | Slip | Explicit Sprint-13 boundary |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-10 billing/ledger | Hard | Yes |
| Sprint-11 payments/webhooks | Hard | Yes |
| Provider settlement data (sandbox) | Hard | Yes |
| Finance SME tolerance decision | Hard | Yes |
| Sprint-09 move-out checklists | Soft | For disposition UX |
| Sprint-13 | Downstream | Financial soak & replay → **M5** |

---

## Deliverables

1. Reconciliation and disposition schema/APIs.
2. Reconciliation + arrears + disposition UIs.
3. Dual-control refund/disposition flows.
4. Parallel comparison report/tool.
5. Tolerance document + initial recon evidence.
6. Finalized daily recon and payment-incident runbooks.
7. Staging end-to-end money path demo (bill→pay→reconcile→age).

---

## Estimated Time

| Track | Estimate |
|---|---|
| Recon domain + settlement ingest | 3–4 days |
| Aging/arrears | 1–2 days |
| Deposit disposition + refund SoD | 2 days |
| UI workspaces | 2–3 days |
| Parallel compare + runbooks + SME | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. Acceptance criteria met; recon demo + tolerance doc signed.
2. SoD tests prove identity separation on refunds/dispositions.
3. Coding standards, CI, isolation tests pass.
4. Runbooks complete and linked from ops index.
5. No critical/high financial-control defects open.
6. Independently deployable control features on existing billing/payments.
7. Handoff: Sprint-13 soak executes repeated cycles, webhook chaos, worker kills, and formal **M5** exit.
