# Sprint-09 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-09  
**Review date:** 2026-07-24  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-09](../sprints/Sprint-09.md) only — **no Sprint-10** features evaluated or implemented  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [Alpha-Product-Review.md](./Alpha-Product-Review.md) · [Sprint-09-Implementation.md](./Sprint-09-Implementation.md)

---

## Summary

Sprint-09 delivers the operational lease lifecycle after Sprint-08 activation: move-in with optional key checkout, renewal draft successors, allocation transfer under EXCLUDE rules, notice recording, move-out checkout (mandatory checklist + key reconciliation), terminate-with-reason, occupancy event timeline, pending-action queues, and a thin Home dashboard of leasing exceptions. Rent collection, invoices, meters ledger, and security deposit execution remain correctly **out of scope** (Sprint-10), with explicit `financeNote` / deposit disposition preview messaging.

This review found **critical** defects in key reconciliation (complete move-out could succeed while keys remained `ISSUED`) and renew concurrency (version claim without count check; renewal uniqueness outside the transaction), plus **high** gaps: empty checklist acceptance, transfer allocation window anchored to lease `startDate` instead of `effectiveAt`, unreachable `MOVE_OUT_DUE` pending-action branch, holdover writes on GET pending-actions/home, and incomplete T09 transfer/key coverage. Safe in-repo fixes were applied in this session.

After fixes, local gates pass: **lint**, **typecheck**, **unit**, **build**. Integration/isolation remain **DB-gated** (Postgres). Staging / M4 human sign-off remain process residuals. Transfer/notice staff UIs stay thin (API-first), which is acceptable for Sprint-09 MVP but is residual product risk for Alpha operators.

**Verdict:** Sprint-09 **meets technical acceptance for Conditional Go toward Sprint-10**, with rent collection still required before day-2 operations / Beta claims from the Alpha Product Review.

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Move-out / keys | `completeMoveOut` treated `keysReconciled: true` as sufficient even when `asset_keys` remained `ISSUED`, so reconciliation was a no-op. | Critical |
| C2 | Renew / concurrency | Renewal existence check ran outside the TX; `updateMany` version claim ignored `count === 0`, allowing duplicate DRAFT successors / skipped 412 under race. | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Move-out checklist | `startMoveOut` seeded `checklist: []`, so complete accepted empty checklists. | High |
| H2 | Transfer | New allocation used lease `startDate` instead of transfer `effectiveAt`, misaligning EXCLUDE windows. | High |
| H3 | Pending actions | `MOVE_OUT_DUE` vs `EXPIRING_SOON` date comparison made `MOVE_OUT_DUE` effectively unreachable. | High |
| H4 | Side effects on GET | Holdover flagging wrote `holdoverFlag` + occupancy events during `listPendingActions` / Home GET. | High |
| H5 | AuthZ / keys | Key checkout/return paths did not assert `assets.keys.manage`. | High |
| H6 | Tests | Missing T09-04 transfer EXCLUDE coverage; move-out path did not exercise key blocking. | High |

---

## Minor Issues

### Medium (open / deferred)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | UI | Transfer and notice remain API-only (no dedicated staff wizards). | Medium |
| M2 | Renew product | Renew creates DRAFT successor only; prior lease stays ACTIVE until notice/terminate (draft-first MVP). | Medium |
| M3 | Inventory messaging | Move-in bumps unit `version` only; availability remains allocation-driven (occupancy note corrected). | Medium |
| M4 | Holdover persistence | Holdover is derived on read; durable `holdoverFlag` / `HOLDOVER_FLAGGED` event no longer written on GET (flagging mutation deferred). | Medium |
| M5 | Testing / process | T09-* integration suite is DB-gated; staging demo / M4 human sign-off not evidenced here. | Medium |
| M6 | A11y | Labels/`role="alert"`/`status` present; no automated WCAG suite. | Medium |
| M7 | Domain purity | Lifecycle/lease rules still throw Nest HTTP exceptions (same Sprint-08 residual). | Medium |

### Low

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | UI | Move-out completes mandatory checklist via patch in one step (operator ack) rather than interactive per-item editing. | Low |
| L2 | Dashboard | “Leasing queue” links to `/app/leases` (pending filter was a dead `?pending=1` query). | Low |
| L3 | Docs | Operator onboarding still thin vs engineering sprint docs. | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | Complete move-out requires zero `ISSUED` keys **and** `keysReconciled: true`; patch supports `returnAllIssuedKeys` with `assets.keys.manage` |
| C2 | Renew claims version with `count` check; renewal uniqueness check moved inside TX; renewal `startDate` must be ≥ prior `endDate` when prior ends |
| H1 | `startMoveOut` seeds four incomplete mandatory checklist items; complete rejects empty/incomplete checklist |
| H2 | Transfer applies successor allocation from `effectiveAt` |
| H3 | Pending-actions date-only buckets: HOLDOVER (&lt; today), MOVE_OUT_DUE (≤ +7d), EXPIRING_SOON (≤ window) |
| H4 | Removed holdover DB writes from GET pending-actions/home |
| H5 | Assert `assets.keys.manage` on move-in checkouts and move-out returns / return-all |
| H6 | Added T09-04 transfer overlap rejection; T09-05 patches checklist + returns keys; T09-05b asserts keys block complete |
| UX | Move-out UI patches checklist + returns keys before complete; warn when terminate permission missing |
| UX | Lease detail shows occupancy timeline; Home dead `?pending=1` link fixed |
| Contracts | `patchMoveOutRequestSchema.returnAllIssuedKeys` |
| Docs | Sprint-09.md pending/occupancy permissions `leases.read` → `leases.list` / `leases.view` |
| Copy | Occupancy occupied note clarifies allocation as availability source of truth |

---

## Verification matrix

| Criterion | Status | Notes |
|---|---|---|---|
| Sprint scope (no Sprint-10) | ✅ Pass | No invoices/payments/meters ledger/`security_deposits` execution |
| Move-in workflow | ✅ Pass (post-fix) | Occupancy flip, checklist, keys + permission, events/outbox |
| Move-out workflow | ✅ Pass (post-fix) | Start → mandatory checklist → key reconcile → complete → terminate |
| Rent collection workflow | ✅ N/A (Sprint-10) | Explicitly deferred; dashboard/API finance notes present |
| Dashboard usefulness | ✅ Pass (thin) | Exception counts + pending list; not full ops desk |
| Database consistency | ✅ Pass | Lifecycle columns + `occupancy_events` / `asset_keys`; EXCLUDE reused |
| API consistency | ✅ Pass (post-fix) | Org paths, If-Match, idempotent move-in/complete/terminate |
| UI consistency | ✅ Pass (post-fix) | Move-in/out/renew + Home; transfer/notice API-first residual |
| Multi-tenant isolation | ✅ Pass | `tenantId` + property scope; T09-08/09 authored |
| Security / RBAC | ✅ Pass (post-fix) | Lifecycle permissions + `assets.keys.manage` on key paths |
| Performance | ✅ Pass | Pending list capped; adequate for 30–50 room Alpha |
| Error handling | ✅ Pass (post-fix) | Checklist / keys / version / overbook codes |
| Validation | ✅ Pass (post-fix) | Zod literals; renewal date guard; checklist mandatory |
| Accessibility | ⚠️ Partial | Basic roles; no automated a11y |
| Testing | ⚠️ Partial | Unit pass; T09-* strengthened; integration DB-gated |
| Documentation consistency | ✅ Pass (post-fix) | Sprint permission naming aligned; rent deferred labeled |

---

## Remaining Risks

1. **Rent / deposits (Sprint-10)** — Alpha Product Review day-2 money loop still missing; operators need parallel spreadsheets until Sprint-10.
2. **Staging / M4 sign-off** — Full activate → move-in → renew/transfer → move-out → terminate demo not evidenced in this environment.
3. **Transfer/notice UX** — API exists; staff without API clients cannot easily transfer or record notice from the UI.
4. **Renewal overlap product** — Draft successor can copy allocation while prior lease remains ACTIVE; operators must sequence end/activate carefully (EXCLUDE will reject contested activates).
5. **Holdover durability** — Derived HOLDOVER actions no longer persist `holdoverFlag` on read; durable flagging needs an explicit mutation or job later.
6. **Integration CI** — T09-* not executed here without Postgres.

---

## Alpha Review Items Resolved

| Alpha gap ([Alpha-Product-Review.md](./Alpha-Product-Review.md)) | Sprint-09 outcome |
|---|---|
| Hand keys / move-in | **Resolved** — move-in API + UI, occupancy `OCCUPIED`, optional key checkout |
| Renew / move-out / deposit preview | **Partially resolved** — renew draft, move-out checkout, terminate; deposit **preview only** (no ledger) |
| Morning “what needs me?” Home | **Resolved (thin)** — pending-action widgets + finance note |
| Occupancy vs contractual status | **Resolved** — `occupancyState` separated from lease `status` |
| Business workflow continuity past activate | **Resolved for ops loop** — activate → move-in → renew/move-out → terminate |
| Monthly rent due / payment / arrears | **Not resolved** — correctly deferred to **Sprint-10** |
| Maintenance / resident portal | **Not in Sprint-09** | 

---

## Overall Score

| Dimension | Score | Notes |
|---|---:|---|
| Sprint scope compliance | **9.0 / 10** | Clean boundary vs Sprint-10 |
| Lifecycle workflow completeness | **8.0 / 10** | Core paths solid post-fix; transfer/notice UI thin |
| Dashboard usefulness | **7.0 / 10** | Useful exception queue; not full morning OS |
| Security / isolation / RBAC | **8.5 / 10** | Keys permission + org/property gates |
| Data / API consistency | **8.5 / 10** | Post CAS/EXCLUDE/checklist fixes |
| Tests / evidence | **6.5 / 10** | Stronger T09 authorship; DB/staging evidence gap |
| Docs consistency | **8.0 / 10** | Implementation + sprint permission naming aligned |

**Overall Sprint-09 review score: 8.0 / 10**

---

## Recommendation

**Conditional Go → Sprint-10 (rent collection / finance ledger).**

Do **not** claim Beta or “day-2 operations complete.” Ship Sprint-09 as the occupancy bridge for Alpha design partners, keep finance explicitly deferred, close staging demo evidence for M4, and prioritize Sprint-10 invoices/payments/deposit execution next. Do **not** implement Sprint-10 in this review session.
