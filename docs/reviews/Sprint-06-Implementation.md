# Sprint-06 Implementation Summary

**Sprint ID:** Sprint-06 — Bulk Inventory Import and Scale Baseline  
**Implementation date:** 2026-07-23  
**Scope:** Sprint-06 business features + Mid-Project Improvement Plan items assigned to Sprint-06  
**Baseline:** [Sprint-06.md](../sprints/Sprint-06.md) · [Mid-Project-Improvement-Plan.md](./Mid-Project-Improvement-Plan.md) · [Mid-Project-Audit.md](./Mid-Project-Audit.md) · [Sprint-05-Implementation.md](./Sprint-05-Implementation.md)  
**Out of scope:** Sprint-07 (residents/leasing start, Redis rate limit, MFA recovery, browser e2e suite, OpenAPI publish if deferred)

---

## Summary

Sprint-06 delivers M3-capable inventory import (CSV template → dry-run → async commit → rejection report), governed export, bulk unit status updates, Operations Center listings, org-wide unit listing (eliminating client fan-out), S3-compatible object storage for import artifacts, composite tenant FK hardening, property access grant admin UX, 10k-scale seed + list SLO gate, and documentation/ADR hygiene required by the Mid-Project Improvement Plan. Architecture, tenancy, and Sprint-04/05 RBAC patterns were extended—not redesigned.

**Quality gates (local):** `pnpm lint` · `pnpm typecheck` · `pnpm unit` · `pnpm integration` · `pnpm build` — all green after Sprint-06 fixes.

---

## Sprint-06 features implemented

| # | Feature | Status |
|---|---|---|
| 1 | Inventory CSV template download | Done |
| 2 | Create import job + upload artifact (object storage) | Done |
| 3 | Dry-run validation with totals / errors / zero writes | Done |
| 4 | Async commit via outbox + worker handler | Done |
| 5 | Idempotent re-commit (same `Idempotency-Key`) | Done |
| 6 | Partial success + downloadable row reject reasons | Done |
| 7 | Property Manager scope on import rows | Done |
| 8 | Bulk unit operational status preview + commit (audited) | Done |
| 9 | Governed inventory CSV export (`exports.inventory`) | Done |
| 10 | Operations Center list (`operations.read`) | Done |
| 11 | Import wizard UI + admin route | Done |
| 12 | Org-wide units list API + Portfolio Units single-query UX | Done |
| 13 | Scale seed script (`pnpm seed:scale-inventory`) | Done |
| 14 | List/search SLO integration baseline (T06-08/09) | Done (CI default ~2.5k; 10k via env) |
| 15 | Pilot mapping rules + import runbook | Done |
| 16 | Property access grant admin API + member-detail UI | Done |
| 17 | Permission keys: `imports.inventory`, `exports.inventory`, `operations.read` | Done |

---

## Improvement items completed

From [Mid-Project-Improvement-Plan.md](./Mid-Project-Improvement-Plan.md) Sprint-06 backlog:

| Priority | IDs | Theme | Result |
|---|---|---|---|
| P0 | P1, P2, Q1 | Org-wide units API + kill fan-out | `UnitService.listUnitsOrgWide`; web `listUnitsOrg` / `use-units` single cursor query |
| P0 | S2, P6 | S3 SDK + async import | `@aws-sdk/client-s3` Put/Get with local `.data/object-storage/` fallback; outbox event `inventory.import.commit` |
| P0 | P3, P4, P5 | 10k seed + perf gate + indexes | `prisma/seeds/scale-inventory.ts`; scale integration SLO; list indexes in composite FK migration |
| P0 | S5 | Import/export permission keys | Contracts + catalog + `@RequirePermissions` / `@RequireAnyPermissions` |
| P1 | S1, A4 | Composite tenant FKs | Migration `20260725130000_sprint_06_composite_fks_indexes` |
| P1 | Q3 | Property grant admin UX | Grants CRUD API + member detail section |
| P1 | A1, D1, D2, D5 | ADR + docs hygiene | ADR-0005; `docs/08` App Router tree; Sprint-06 Status → Implemented |
| P2 | A3, A5, Q2, Q6 | Module shape + conventions | `imports/domain` rules; worker handler; `CODING_RULES` `lib/*-api.ts` adapter note; isolation includes imports |

**Stretch / partial in Sprint-06 (Improvement Plan preferred Sprint-07 for full depth):**

| ID | Notes |
|---|---|
| Q4 | Partial — shell hides Imports/Operations without keys; broader portfolio nav still mostly role-visible |
| D4 | Import job runbook landed; platform deploy/restore skeletons not fully rewritten |
| D6 | Evidence template deferred to staging demo / M3 sign-off process |
| D3 | OpenAPI publish deferred (Sprint-07 stretch per plan) |
| Q5 | Browser e2e deferred to Sprint-07 |

**Explicitly deferred (not Sprint-06):** S3 Redis rate limit, S4 MFA recovery, Q5 Playwright, residents/leasing (Sprint-07+).

---

## Performance changes

| Change | Detail |
|---|---|
| Org-wide units | `GET /v1/organizations/{orgId}/units` with cursor, `q`, property-scope enforcement |
| Client fan-out removed | Portfolio Units no longer `Promise.all` per property with hard `limit: 100` + null cursor |
| List indexes | Composite indexes supporting `(tenant_id, property_id, status)`, code/search list paths |
| Scale seed | `pnpm seed:scale-inventory` for staging/local 10k+ portfolios |
| SLO gate | `scale.integration.spec.ts` — default `SCALE_TEST_UNIT_COUNT=2500`, `SCALE_LIST_SLO_MS=2000`; set `SCALE_TEST_UNIT_COUNT=10000` for staging proof |
| Async import | HTTP returns quickly; commit work on worker with bounded row application |

---

## Database changes

### Migration `20260725120000_sprint_06_imports`

| Table / artifact | Purpose |
|---|---|
| `import_jobs` | Durable import batch metadata, status, counts, actor, org, type, mapping, idempotency |
| `import_job_rows` | Per-row accept/reject/skip reasons and payloads |
| Related enums/indexes | Job/row status; org + status listing |

### Migration `20260725130000_sprint_06_composite_fks_indexes`

| Change | Purpose |
|---|---|
| Composite `(tenant_id, parent_id)` FKs on inventory/parties/grants children | Reject cross-tenant parent/child linkage at DB |
| Additional list indexes | Support org-wide unit list / import hot paths |

No lease/finance tables. Import writes remain org-scoped and audited.

---

## API changes

Org-scoped under `/v1/organizations/{organizationId}/…` (path org must match session org):

| Method | Path | AuthZ |
|---|---|---|
| `GET` | `/imports/templates/inventory` | `imports.inventory` |
| `POST` | `/imports` | `imports.inventory` |
| `GET` | `/imports/{importId}` | `imports.inventory` |
| `POST` | `/imports/{importId}/dry-run` | `imports.inventory` |
| `POST` | `/imports/{importId}/commit` | `imports.inventory` (+ `Idempotency-Key`) |
| `GET` | `/imports/{importId}/errors` | `imports.inventory` |
| `POST` | `/units/bulk-status` | inventory mutate + scope |
| `GET` | `/operations` | `operations.read` |
| `POST` / `GET` | `/exports` (inventory CSV) | `exports.inventory` |
| `GET` | `/units` (org-wide) | `units.list` + property scope |
| Grants | property access grant admin endpoints | members/roles admin permissions |

**Cross-cutting:** cursor pagination; problem+json; org path non-disclosure (404); PM property scope on import/bulk/list; audit on commit and bulk status.

---

## UI changes

| Route / surface | Change |
|---|---|
| `/app/admin/imports` | Inventory import wizard (template → upload → dry-run → commit → summary) |
| `/app/operations` | Import/operations job list |
| `/app/portfolio/units` | Org-wide list; bulk status + export actions |
| Admin member detail | Property access grant list/assign/end |
| App shell | Permission-gated Imports + Operations nav entries |

---

## Test coverage

| Suite | Coverage |
|---|---|
| Contracts | `packages/contracts/src/sprint-06.contracts.spec.ts` |
| Domain unit | `inventory-import.rules.spec.ts` |
| Imports isolation | T06-01…T06-07 (`imports.integration.spec.ts`) |
| Grants | T06-grants in `authorization.integration.spec.ts` |
| Org-wide units | T06-org-wide-units in inventory integration |
| Scale / SLO | T06-08/09 in `scale.integration.spec.ts` |
| Isolation script | `pnpm isolation` includes imports integration |

---

## Documentation delivered

| Artifact | Purpose |
|---|---|
| `docs/adr/0005-nextjs-app-router.md` | Closes Vite permanently |
| `docs/08-folder-structure.md` | App Router + `features/` tree (no `vite.config` guidance) |
| `docs/sprints/Sprint-06-pilot-mapping-rules.md` | Pilot cleansing / mapping rules |
| `docs/runbooks/import-jobs.md` | Import operator runbook |
| `docs/sprints/Sprint-06.md` | Status → Implemented |
| `docs/reviews/Sprint-06-Implementation.md` | This file |
| `CODING_RULES.md` | Accepted `lib/*-api.ts` adapter convention |

---

## Remaining technical debt

1. **Commit logic duplication** between API commit path and `apps/worker` import handler — extract shared application service before Sprint-07 scale-up.
2. **Full 10k SLO** proven via env override / staging seed; CI uses reduced count for runtime.
3. **Operations Center depth** — list exists; richer metrics (reject rate dashboards, queue depth gauges) still thin.
4. **Slow-query / APM instrumentation** — indexes landed; continuous explain/plan monitoring not wired to dashboards.
5. **Q4/Q5** — full permission-filtered portfolio nav + Playwright e2e remain Sprint-07.
6. **S3/S4** — Redis-backed auth rate limits and MFA recovery still deferred.
7. **D3/D4** — OpenAPI publish and full platform runbook refresh incomplete.
8. **M3 human sign-off** — staging demo + T05-12 / pilot error-handling acceptance still a process gate.

---

## M3 readiness assessment

| Gate | Status |
|---|---|
| Pilot inventory can be imported with dry-run + reject CSV | Met in code |
| Async durable commit | Met |
| PM cannot mutate out-of-scope inventory via import/bulk | Met (tests) |
| Org-wide list without fan-out | Met |
| Scale baseline + seed | Met (staging 10k via seed + env) |
| Improvement Plan P0 items | Met |
| Stakeholder staging demo / written M3 sign-off | Remaining process |

**Recommendation:** Conditional Go for Sprint-07 after staging 10k seed run (`SCALE_TEST_UNIT_COUNT=10000`) and recorded M3 demo evidence.
