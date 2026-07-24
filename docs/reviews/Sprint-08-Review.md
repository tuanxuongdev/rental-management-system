# Sprint-08 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-08  
**Review date:** 2026-07-24  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-08](../sprints/Sprint-08.md) only — no Sprint-09+ features evaluated or implemented  
**Normative baselines:** [CODING_RULES.md](../../CODING_RULES.md) · [AGENTS.md](../../AGENTS.md) · [03-database-design.md](../03-database-design.md) · [04-api-specification.md](../04-api-specification.md) · [06-permission-system.md](../06-permission-system.md) · [ADR-0004](../adr/0004-money-representation.md) · [Sprint-08-Implementation.md](./Sprint-08-Implementation.md)

---

## Summary

Sprint-08 delivers Organization-scoped draft lease create/update, Unit/Bed/capacity allocation with GiST EXCLUDE + capacity locking, review snapshots, idempotent activation (If-Match + Idempotency-Key), do-not-rent gating with permissioned override, `lease.activated` outbox events, document↔lease links, ADR-0004 money, and staff Leasing UI (list/detail/wizard/activate).

This review found a **critical** activate/DNR ordering defect (override path unreachable when review treated DNR as a hard `ready=false` gate before override handling) plus several **high** gaps (version CAS on patch/allocation, mixed-allocation lock ordering, allocation idempotency, lease-linked document property scope, missing bed/document lease tenant-complete FKs). All critical/high items that could be safely corrected in-repo were fixed in this session.

After fixes, local gates pass: lint, typecheck, unit, build. Integration/isolation remain **DB-gated** (Postgres not available in this review environment). Staging demo / human Sprint-08 sign-off and Accountant read-only product path remain process/product residuals.

The implementation **meets Sprint-08 technical acceptance for a Conditional Go toward Sprint-09**, with residual evidence and polish gaps documented below.

---

## Critical Issues

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Activate / DNR | Activation threw `LEASE_INCOMPLETE` on `!review.ready` **before** evaluating do-not-rent override + `leases.override_do_not_rent`, so Owner override could never succeed while DNR marked review not-ready. | Critical |

### High (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Concurrency | `patchLease` updated by `id` only (no `tenantId` / version CAS in the write). | High |
| H2 | Concurrency | `setAllocation` bumped version after allocation without claiming `expectedVersion` first (TOCTOU). | High |
| H3 | Concurrency | Mixed WHOLE vs BED/CAPACITY conflict check ran without unit `FOR UPDATE` (CAPACITY locked after the mixed read). | High |
| H4 | API | `POST …/allocations` lacked required `Idempotency-Key` (API §13 / inventory-commit pattern). | High |
| H5 | Isolation / docs | Property-scoped document list/get ignored lease links; lease-only docs could 404 for PMs with property access. | High |
| H6 | AuthZ / docs | Lease document attach required only `documents.upload`, not also `leases.update` (Sprint-08 attach rule). | High |
| H7 | DB / isolation | `lease_allocations.bed_id` and `document_links.lease_id` lacked tenant-complete composite FKs. | High |
| H8 | UX / activate | Activate UI could submit without override when DNR blocked; messaging did not distinguish DNR-only vs hard blockers. | High |
| H9 | Inventory | Patch of lease dates did not rewrite ACTIVE allocation windows (reservation ≠ commercial term). | High |
| H10 | Activate | Activate did not re-validate mixed/capacity under unit locks inside the claim transaction. | High |

---

## Minor Issues

### Medium / High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | Scope / RBAC | Accountant “read-only commercial terms” user story unmet; Accountant remains inactive stub; Auditor has list/view. | Medium |
| M2 | API / UI | List date filters incomplete; UI loads a single page without cursor “Load more.” | Medium |
| M3 | Testing / process | T08-06 races activate vs setAllocation rather than two concurrent activates; no live CAPACITY overflow race proof in CI without DB. Staging demo / human sign-off not evidenced. | Medium (evidence) |
| M4 | Architecture | `lease.rules.ts` still throws Nest HTTP exceptions (domain should stay Nest-free). | Medium |
| M5 | DB / mixed | Mixed WHOLE vs BED/CAPACITY still app+lock (no Postgres mixed-type EXCLUDE/trigger). Activate now revalidates under lock (H10). | Medium |
| M6 | Idempotency | Narrow concurrent same-key activate race can still surface `LEASE_NOT_DRAFT` instead of replay if idempotency row is not yet visible. | Medium |
| M7 | CI | No migrate/EXCLUDE drift job beyond runtime T08-13 (DB-gated). | Medium |

### Low / partial (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | UI | Create wizard remains ID-entry heavy vs combobox depth in UI specs; parties/recurring charges thin. | Low |
| L2 | API | Create draft still omits Idempotency-Key (API §13 fuller surface). | Low |
| L3 | A11y | Status/alert roles present; no automated WCAG/Playwright a11y suite. | Low |
| L4 | Money display | Decimal stringification may drop trailing zeros (`500.00` → `500`) while ADR accepts entered scale. | Low |

---

## Changes Made

| Fix | What changed |
|---|---|
| C1 | Activate blocks only non-DNR `ERROR` issues; DNR requires override + permission; DNR re-checked inside activate transaction before DRAFT→ACTIVE claim |
| H1 | `patchLease` uses `updateMany` with `tenantId` + `status: DRAFT` + version CAS |
| H2 / H4 | `setAllocation` claims version first; requires Idempotency-Key + hash replay (controller + web client/hook) |
| H3 | Unit `FOR UPDATE` before mixed and capacity checks |
| H5 / H6 | Document list/get scope includes lease→property; upload-intent/createLink assert `leases.update` when `leaseId` set |
| H7 | Migration `20260727130000_sprint_08_review_tenant_fks` — `beds (tenant_id, id)` unique + bed/lease composite FKs |
| H8 | Activate UI requires override+reason when DNR present; clearer blocked messaging; no override permission → explicit alert |
| H9 | Date patch syncs ACTIVE allocation `effectiveFrom`/`effectiveTo` under unit lock + conflict recheck |
| H10 | Activate revalidates mixed/capacity under unit locks before DRAFT→ACTIVE claim |
| Validation | `activateLeaseRequestSchema` requires `overrideReason` when `overrideDoNotRent: true`; `checklistAcknowledged: z.literal(true)`; checklist ack → 422 |
| History | Status history keyset by `(recordedAt, id)` descending |
| Tests | T08-08b Owner override success; T08-10/12 isolation expanded; contracts reject override without reason; allocation test helper updated |
| Docs | `leases.override_do_not_rent` in permission catalog doc; Sprint-08.md `leases.read` → `list`/`view` |
| Hygiene | Import-order lint fixes |

---

## Verification matrix

| Criterion | Status | Notes |
|---|---|---|---|
| Sprint scope (no Sprint-09) | ✅ Pass | No move-in / renew / terminate / billing |
| Architecture consistency | ✅ Pass (post-fix) | Thin controller; application services; Nest exceptions remain in `lease.rules` (M4) |
| Database consistency | ✅ Pass (post-fix) | ADR money; GiST EXCLUDE; review tenant FKs added |
| API consistency | ✅ Pass (post-fix) | Org path; If-Match; activate + allocation idempotency; review/activate |
| UI consistency | ✅ Pass (post-fix) | Leasing nav; wizard; activate consequences + DNR UX |
| Multi-tenant isolation | ✅ Pass (post-fix) | `tenantId` on reads/writes; cross-org 404 tests authored; lease doc scope |
| Security | ✅ Pass (post-fix) | DNR override permission; checklist; property scope; lease attach authz |
| Performance | ✅ Pass | Cursor lists; unit row lock serializes allocation writers |
| Error handling | ✅ Pass (post-fix) | DNR / incomplete / version / exclusion problem codes |
| Validation | ✅ Pass (post-fix) | Money Zod; activate refine; allocation mode match |
| Accessibility | ⚠️ Partial | Labels/alerts; no automated a11y |
| Testing | ⚠️ Partial | Unit + contracts pass; T08-* authored; integration not executed here (no Postgres) |
| Documentation consistency | ✅ Pass (post-fix) | ADR Accepted; permission + sprint naming aligned |

---

## Remaining Risks

1. **Staging / human demo** — create→allocate→review→activate (incl. DNR override and overlap rejection) not evidenced in this environment.
2. **Accountant story** — product path still unmet; decide activate Accountant list/view or defer explicitly before M4 claim.
3. **Mixed-allocation DB constraint** — app + unit lock harden WHOLE vs BED/CAPACITY; a reviewed Postgres trigger/EXCLUDE for mixed types would close residual bypass if app code is skipped.
4. **Activate inventory** — mixed/capacity revalidated under unit locks at activate (H10); a reviewed Postgres mixed-type EXCLUDE/trigger would still harden WHOLE vs BED/CAPACITY if app code is bypassed.
5. **Integration CI** — run full `pnpm isolation` / leasing suite against migrated Postgres including new tenant FK migration.
6. **Domain purity (M4)** and list pagination/date filters remain polish before claiming full API/UI spec depth.

---

## Overall Score

**8.2 / 10**

Strong Sprint-08 core (money ADR, EXCLUDE, CAS activate, outbox, leasing UI) after review hardening. Deducted for pre-review DNR/activate defect, allocation idempotency/CAS gaps, tenant FK expand, and unfinished process evidence (staging + Accountant story).

---

## Recommendation

**Approve with conditions** for Sprint-08 technical merge / Conditional Go toward Sprint-09:

1. Ship review fixes (already applied in this session), including migration `20260727130000_sprint_08_review_tenant_fks`.
2. Run leasing integration/isolation against Postgres after migrate; confirm T08-01…13 + T08-08b.
3. Complete staging demo + sign-off before claiming full Sprint-08 DoD process closure.
4. Decide Accountant read-only path (activate role grants vs explicit deferral note).
5. **Do not implement Sprint-09 in this review session** (none started).

---

## Quality gates (post-review)

- `pnpm lint` / `typecheck` / `unit` / `build` — **pass** after fixes  
- Sprint-08 integration (T08-* + T08-08b) — **authored; not executed** (Postgres unreachable)  
- Sprint-09 — **not started**
