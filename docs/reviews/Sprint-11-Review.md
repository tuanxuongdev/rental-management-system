# Sprint-11 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-11  
**Review date:** 2026-07-24  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-11](../sprints/Sprint-11.md) only — **no Sprint-12** features evaluated or implemented  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [ADR-0004](../adr/0004-money-representation.md) · [ADR-0006](../adr/0006-billing-policy.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [Sprint-11-Implementation.md](./Sprint-11-Implementation.md) · [Beta-Product-Review.md](./Beta-Product-Review.md) · [Sprint-10-Review.md](./Sprint-10-Review.md)

---

# Summary

Sprint-11 delivers the staff-only money collection exit: offline cash/bank recording with allocations, receipts (`RCP-{YYYY}-{seq}`), sandbox payment intents + HMAC webhooks, refund **PENDING** requests, thin arrears by due date, thin deposit disposition execute, and finance dashboard widgets. Portal pay is correctly deferred. Full aging buckets, bank reconciliation workspace, and dual-control refund/deposit approve remain Sprint-12 (not implemented).

This review found a **critical money defect** (manual `unallocatedAmount` double-subtracted) plus high webhook/raw-body, secret default, refund concurrency, deposit over-reservation, and UI allocate/evidence/idempotency gaps. Safe in-repo fixes were applied in this session (see Changes Made). Local gates pass: **lint**, **typecheck**, **unit** (73), **build**. Integration T11-* remain DB-gated pending migration apply.

**Verdict:** Sprint-11 **Conditional Go** for closed-Beta money desk after the applied fixes, provided staging migration + T11-* evidence and remaining RC process gates are tracked. Do **not** claim full RC until B3 staging sign-off and soft B5/B6 (or waivers) land.

---

# Critical Issues

### Critical / High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Payments money | Manual record seeded `unallocatedAmount = amount − allocations` then `applyAllocationsInTx` subtracted again → negative / wrong unallocated (broke T11-05/07 semantics). | Critical |
| H1 | Webhooks | Nest lacked `rawBody: true`; HMAC verified `JSON.stringify(body)` not provider bytes. | High |
| H2 | Webhooks | `PAYMENTS_WEBHOOK_SECRET` defaulted to hardcoded `sandbox-secret` in all envs. | High |
| H3 | Refunds | Concurrent refund requests lacked payment `FOR UPDATE` → over-request possible. | High |
| H4 | Deposits | Disposition create ignored outstanding DRAFT/APPROVED lines → over-commit vs held. | High |
| H5 | Intents | Payment intent without invoice/lease skipped property scope (PM org-wide). | High |
| H6 | UI / API | No allocate UI; unstable Idempotency-Key on retry; no evidence upload; no duplicate-ref handling; receipt not linked. | High |

### Critical / High (open — document or later)

| ID | Area | Issue | Severity |
|---|---|---|---|
| O1 | Ledger | Settlement journals post cash/AR for **allocated** amount only; unallocated credit is off-ledger on `payment_transactions` until later allocate (which then posts cash). Acceptable thin model; full unapplied-cash liability is Sprint-12 polish. | High (known) |
| O2 | Idempotency | Money writers still perform work then `resolveOrCreate`; concurrent same-key races can still double-post before unique key wins (pattern shared with Sprint-10). Needs reservation-first key for money paths. | High |
| O3 | Testing | T11-01/03/06/08/11/12 incomplete or DB-gated; chaos evidence not in CI without Postgres. | High |

---

# Minor Issues

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | RBAC / get | Payments with `propertyId = null` skip PM property gate on get/receipt/refund. | Medium |
| M2 | Dashboard | Multi-currency orgs silently total first unpaid currency only. | Medium |
| M3 | Pagination | Payments/arrears UI hard-limits 50 with no “Load more”. | Medium |
| M4 | Refund UI | Refund PENDING API exists; staff refund request screen not shipped (API-only). | Medium |
| M5 | Schema | Composite `@@unique([tenantId, id])` present in SQL migration, omitted from Prisma models (migrate-diff risk). | Medium |
| M6 | Ops webhook | FAILED status update can roll back with processing errors (ops visibility gap). | Low |
| M7 | A11y | Labels/`role="alert"` present; no focus-move to error summary; no automated WCAG suite (Beta B6). | Low |
| M8 | Evidence policy | Evidence recommended in UI; not hard-required server-side for cash. | Low |
| M9 | Portal | Stretch portal pay deferred (documented) — correct. | Info |

---

# Beta Review Blockers Resolved

| Beta ID | Assigned to Sprint-11? | Outcome after review |
|---|---|---|
| **B1** Payment recording / allocation | Yes (primary) | **Resolved** after C1 fix — staff cash/bank + allocate + ledger + receipts |
| **B2** Arrears / aging desk | Thin yes (full aging = S12) | **Thin resolved** — unpaid invoices by `dueDate` + Arrears UI |
| **B3** Staging + human sign-off | Process (not code) | **Not resolved** |
| **B4** Deposit settlement | Thin yes (SoD = S12) | **Thin resolved** after H4 fix — create+execute MVP |
| **B5** Mobile field ops | Soft / label | **Not resolved** |
| **B6** A11y evidence | Soft | **Not resolved** |

Sprint-11.md scope items verified: sandbox PSP (no PAN columns), webhook HMAC + event-id idempotency, offline recording, receipts, refund PENDING, staff UI, portal deferral, runbook present. Out of scope Sprint-12 recon/aging **not** implemented.

---

# Remaining RC Blockers

| ID | Item | Track |
|---|---|---|
| B3 | Staging landlord demo + M4/M5-prep human sign-off | Process |
| B5 | Mobile support or explicit desk-only RC labeling | UX |
| B6 | WCAG evidence pack | UX / compliance |
| Ops | Apply `20260730120000_sprint_11_payments`; re-seed Accountant permissions; run T11-* + isolation | Engineering |
| O2 | Idempotency reservation-first on money mutations | Engineering |
| S12 | Aging buckets, recon workspace, dual-control refund/deposit approve | Product |
| Trust | Privacy stub for closed Beta PII | Process |
| Stretch | Portal pay after resident↔user linkage | Pilot prep |

**RC readiness:** Money day-2 collection path exists in-product. Overall RC remains **No-Go** until B3 (+ soft gates/waivers) clear.

---

# Changes Made

| Fix | What changed |
|---|---|
| C1 | Manual payment seeds `unallocatedAmount = amount`; allocations subtract once |
| H1 | `NestFactory` `rawBody: true`; webhook controller prefers `request.rawBody` |
| H2 | Webhook secret fail-closed unless `NODE_ENV=test` or `PAYMENTS_WEBHOOK_ALLOW_DEFAULT_SECRET=true` |
| H3 | Refund request locks payment row `FOR UPDATE` |
| H4 | Disposition create locks deposit and subtracts outstanding non-executed lines from available |
| H5 | Intent requires `invoiceId` or `leaseId` (API + Zod refine) |
| Money hygiene | Lease currency match; duplicate `externalReference` → `DUPLICATE_EXTERNAL_REFERENCE` |
| Idempotency | Record/allocate/refund honor `resolveOrCreate.replayed` return |
| UI | Stable Idempotency-Key; evidence upload; allocate form; receipt page/print; accounting/evidence fields; invoice deep-link seeds amount/currency; deposit keys; duplicate-ref error copy |
| Tests | Unit assertion for unallocated arithmetic |

---

# Overall Score

**7.6 / 10** (Sprint-11 implementation quality after review fixes)

| Dimension | Score | Notes |
|---|---|---|
| Scope compliance | 8.5 | Staff exit + thin B2/B4; portal deferred; no S12 creep |
| Money correctness | 7.5 | C1 fixed; O1 ledger thin model; O2 residual race |
| Security / webhooks | 7.5 | HMAC + fail-closed secret; raw body enabled |
| Isolation / RBAC | 8.0 | Org-scoped; PM property gaps on null propertyId |
| UI completeness | 7.5 | Collection desk usable; refund UI API-only; pagination thin |
| Tests / evidence | 6.5 | Unit green; integration authored but DB-gated |
| Docs consistency | 8.0 | Implementation + runbook aligned after review |

---

# Recommendation

**Conditional Go** to proceed toward closed design-partner Beta money desk and Sprint-12 planning.

**Do not** declare Release Candidate until:

1. Staging migration applied and T11-02/04/05/07/09 (+ preferably T11-01/08) pass against live DB.  
2. B3 staging/human sign-off completed.  
3. Remaining soft blockers (B5/B6) waived or scheduled with partner contracts.

Sprint-12 should prioritize aging + recon + dual-control SoD, and optionally unapplied-cash ledger + reservation-first idempotency for money mutations.
