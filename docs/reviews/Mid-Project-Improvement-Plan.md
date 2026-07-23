# Mid-Project Improvement Plan

**Document ID:** RPM-IMPROVE-MID-01  
**Date:** 2026-07-23  
**Based on:** [Mid-Project-Audit.md](./Mid-Project-Audit.md) (RPM-AUDIT-MID-01)  
**Audience:** Engineering leads, product owners, architects  
**Constraint:** Planning artifact only — **no code implementation** in this document’s producing session

This plan decomposes every audit score into evidence, required improvements, effort, and owning sprint. Effort is engineering calendar estimate for one full-stack engineer (or equivalent), excluding stakeholder wait time.

---

## Score overview

| Category | Score | Target after planned work | Primary owning sprint(s) |
|---|---:|---:|---|
| Architecture | 7.5 | ≥ 8.5 | Sprint-06 (structure) · Sprint-07+ (domain ports) |
| Code Quality | 7.0 | ≥ 8.0 | Sprint-06 · Sprint-07 (e2e/nav) |
| Security | 8.0 | ≥ 8.5 | Sprint-06 (S3/FK) · Sprint-07/09 (auth harden) · Sprint-21 (pen-test) |
| Performance | 5.5 | ≥ 8.0 | **Sprint-06** (mandatory for M3) |
| Documentation | 6.5 | ≥ 8.0 | Sprint-06 week 0–1 · continuous |

**Program rule:** Do not start Sprint-07+ domain work until Performance and Sprint-06 M3 gates are credible, unless dependency-map soft path is explicitly re-approved.

---

## 1. Architecture — 7.5 / 10

### Why this score

The modular monolith is correctly shaped and matches normative rules for monorepo, Organization isolation, contracts package, and domain vocabulary. Points were withheld for incomplete clean-architecture layering inside Nest modules (`domain/` ports thin/absent), aspirational trees (terraform/monitoring/Vite examples), and historical Vite↔Next ambiguity (partially corrected in docs).

### Evidence from the repository

| Evidence | Path / artifact |
|---|---|
| Monorepo layout matches CODING_RULES | `apps/web`, `apps/api`, `apps/worker`, `packages/{ui,contracts,config,testing}`, `prisma/` |
| Domain modules present | `apps/api/src/modules/{identity,tenancy,inventory,parties,audit,meta}` |
| Controllers thin; use cases in `application/` | e.g. `inventory/application/*.service.ts`, `presentation/*controller.ts` |
| Missing module `domain/` / module-local `infrastructure/` | Inventory/parties are application + presentation only |
| Worker outbox + tenant fail-closed | `apps/worker/src/outbox/` |
| Contracts boundary | `packages/contracts/src/{permissions,inventory,parties,rbac}.ts` |
| Docs stack note (Next.js) | `docs/08-folder-structure.md` §1; `CODING_RULES.md` stack note |
| Vite trees still in deeper `docs/08` examples | `docs/08-folder-structure.md` (historical SPA sections) |

### What must be improved

| ID | Improvement | Acceptance signal |
|---|---|---|
| A1 | Author **ADR: Next.js App Router** (close Vite permanently) | Accepted ADR under `docs/adr/` |
| A2 | Replace or clearly mark remaining Vite SPA trees in `docs/08` with App Router + `features/` layout | Docs PR; no contradictory “create vite.config” guidance |
| A3 | Introduce `domain/` ports for inventory/import as import module lands (invariants free of Prisma) | Import/job domain rules not in controllers |
| A4 | Plan composite tenant FK expand (architecture + migration strategy) | Design note + migration sketch; see Security S1 |
| A5 | Keep worker domain `handlers/` emerging with import jobs (not a god-consumer) | Sprint-06 import handlers under clear ownership |

### Estimated effort

| ID | Effort |
|---|---|
| A1 | 0.5 day |
| A2 | 1–1.5 days |
| A3 | 2–3 days (as part of import module, not a standalone rewrite) |
| A4 | 0.5–1 day design + 2–4 days migration (paired with Security) |
| A5 | Absorbed into Sprint-06 import worker work |

### Which Sprint

| ID | Sprint |
|---|---|
| A1, A2 | **Sprint-06** (week 0–1 docs/ADR; non-blocking for import code if ADR drafted day 1) |
| A3, A5 | **Sprint-06** (with import module) |
| A4 | **Sprint-06** hardening track (or first hardening PR before import commit path) |
| Broader domain-layer for leasing/billing | **Sprint-08+** when those modules appear — do not retrofit everything now |

**Path to ≥8.5:** Complete A1–A4 and land import with clear module boundaries (A3/A5).

---

## 2. Code Quality — 7.0 / 10

### Why this score

Sprint-04/05 review hardening produced solid application services, Zod contracts, and strong CI (lint, typecheck, boundaries, isolation). Score is held down by client-side list fan-out, incomplete feature-folder conventions, thin e2e/a11y automation, and UI authz polish gaps (nav always visible).

### Evidence from the repository

| Evidence | Path / artifact |
|---|---|
| Review-fixed inventory isolation | `docs/reviews/Sprint-05-Review.md`; `inventory.integration.spec.ts` |
| Contracts + sprint specs | `packages/contracts/src/sprint-0{2,3,4,5}.contracts.spec.ts` |
| CI quality + isolation jobs | `.github/workflows/ci.yml`; `pnpm isolation` |
| Units list fan-out / truncation | `apps/web/src/features/inventory/hooks/use-units.ts` (`Promise.all` per property; `limit: 100`; flattened `nextCursor: null`) |
| API clients outside `features/*/api` | `apps/web/src/lib/{admin,portfolio,auth}-api.ts` |
| Feature barrels | `apps/web/src/features/{admin,inventory,parties}/index.ts` |
| No browser e2e suite | No `apps/web/e2e` / Playwright config |
| Nav not permission-filtered | `apps/web/src/components/layouts/app-shell.tsx` |

### What must be improved

| ID | Improvement | Acceptance signal |
|---|---|---|
| Q1 | Replace units fan-out with org-wide cursor API + single query hook | No N× property fetches; real `nextCursor` |
| Q2 | Align feature folders gradually (`features/<domain>/api` or documented adapter rule in CODING_RULES) | Written convention; new features follow it |
| Q3 | Property access grant admin UX (list/assign/end grants) | Operator can scope a PM without SQL |
| Q4 | Permission-aware shell nav (hide links lacking keys; server still authoritative) | Auditor does not see mutate entry points as primary CTAs |
| Q5 | Browser e2e: login → org switch → property scope → list isolation smoke | CI job or nightly; covers T04-06 / portfolio scope |
| Q6 | Keep isolation tests mandatory for every new org-owned endpoint | PR checklist / CI already present — enforce in review |

### Estimated effort

| ID | Effort |
|---|---|
| Q1 | 2–3 days (API + contracts + web + tests) — overlaps Performance P1 |
| Q2 | 0.5 day docs + incremental refactors (1–2 days if migrating existing clients) |
| Q3 | 3–4 days (API if missing surface + admin UI) |
| Q4 | 1–1.5 days |
| Q5 | 3–5 days (harness + 3–5 critical flows) |
| Q6 | Process only (0.25 day) |

### Which Sprint

| ID | Sprint |
|---|---|
| Q1, Q3, Q6 | **Sprint-06** (Q1 is M3-critical; Q3 supports PM import stories) |
| Q2 | **Sprint-06** (docs) · refactor opportunistic |
| Q4, Q5 | **Sprint-07** preferred (quality hardening) **or** Sprint-06 stretch if capacity |

**Path to ≥8.0:** Land Q1 + Q3 + Q6 in Sprint-06; Q4/Q5 next.

---

## 3. Security — 8.0 / 10

### Why this score

Security fundamentals for M2 are in good shape: deny-by-default RBAC, org path non-disclosure, no caller tenant headers, memory access tokens, HttpOnly refresh cookies, problem+json, isolation CI, secret/container scanning. Remaining gaps are defense-in-depth (composite FKs), multi-instance rate limiting, deferred MFA recovery, and a non-functional S3 upload path that becomes a security/ops risk once import stores artifacts.

### Evidence from the repository

| Evidence | Path / artifact |
|---|---|
| Fail-closed permissions | `apps/api/src/common/auth/permissions.guard.ts` |
| Org header rejection | `OrganizationHeaderGuard`; `app.http.spec.ts` |
| Org path guard | `OrganizationPathGuard` |
| Property scope | `authorization.service.ts` (`resolveAccessiblePropertyIds`, `assertPropertyAccess`) |
| Token storage | `apps/web/src/state/auth-store.ts` (no persist) |
| Refresh cookie | `refresh-cookie.service.ts` + ADR-0001 |
| Problem Details | `problem-details.filter.ts` |
| Isolation CI | `pnpm isolation`; CI `isolation-tests` job |
| S3 stub | `apps/api/src/infrastructure/storage/s3-storage.client.ts` (“SDK integration lands with document module”) |
| Composite FK gap | Sprint-05 Review H9; inventory migration single-column FKs |
| In-memory rate limit | Identity rate limiter (Sprint-03/04 carryover) |
| MFA recovery deferred | Sprint-04 Review H10 |

### What must be improved

| ID | Improvement | Acceptance signal |
|---|---|---|
| S1 | Composite `(tenant_id, …)` FK expand/migrate for inventory/parties (and grants) | DB rejects cross-tenant parent/child rows |
| S2 | Real S3-compatible Put/Get with org-scoped keys + IAM least privilege | Import upload + rejection CSV round-trip in staging |
| S3 | Redis-backed rate limiting for auth-sensitive endpoints | Shared limit across API replicas |
| S4 | MFA recovery-code enrollment productization | User can enroll/store hashed recovery codes |
| S5 | Import permission keys (`imports.*`, `exports.*`) seeded + guarded | Catalog + `@RequirePermissions` on import routes |
| S6 | Pen-test + WCAG gates | Roadmap Phase 9 / Sprint-21 — do not fake early |

### Estimated effort

| ID | Effort |
|---|---|
| S1 | 2–4 days (design + migration + backfill validation + tests) |
| S2 | 2–3 days (SDK, config, staging bucket, smoke tests) |
| S3 | 1–2 days |
| S4 | 2–3 days |
| S5 | 1 day (with Sprint-06 import module) |
| S6 | External + remediation sprints (program Phase 9) |

### Which Sprint

| ID | Sprint |
|---|---|
| S2, S5 | **Sprint-06** (week 1 hard deps) |
| S1 | **Sprint-06** hardening track (parallel to import) |
| S3, S4 | **Sprint-07** or dedicated auth hardening spike before pilots |
| S6 | **Sprint-20–21** per roadmap (M9) |

**Path to ≥8.5:** Complete S1 + S2 + S5; schedule S3/S4 soon after M3.

---

## 4. Performance — 5.5 / 10

### Why this score

Lowest score: current inventory UX is acceptable for small portfolios only. The units list fan-out and hard page size create silent incompleteness and will not meet Sprint-06’s ≥10,000 Unit SLO. There is no synthetic 10k seed or automated p95 list/search gate yet. Import at scale without async worker + object storage will time out.

### Evidence from the repository

| Evidence | Path / artifact |
|---|---|
| N× `listUnits` when scope=`ALL` | `apps/web/src/features/inventory/hooks/use-units.ts` |
| Hard `limit: 100` + null flattened cursor | Same file |
| Per-property units API only | `inventory.controller.ts` (`properties/:id/units`) |
| Partial indexes exist; 10k unproven | `20260724130000_sprint_05_review_partial_uniques` |
| Sprint-06 requires 10k seed + perf suite | `docs/sprints/Sprint-06.md` |
| Outbox/worker ready; import jobs not built | `apps/worker`; no `import_jobs` migration yet |
| S3 stub blocks artifact pipeline | `s3-storage.client.ts` |

### What must be improved

| ID | Improvement | Acceptance signal |
|---|---|---|
| P1 | Org-wide `GET /organizations/{orgId}/units` with cursor, filters, property-scope | Single request lists; stable order; isolation tests |
| P2 | Web uses P1; remove fan-out | Portfolio Units page pages correctly at scale |
| P3 | 10k synthetic Unit seed tool | Reproducible seed in staging/CI |
| P4 | Perf tests: p95 list/search under load (CI nightly or staging gate) | Documented SLO pass evidence |
| P5 | Index review for import/list predicates (explain plans) | No sequential scans on hot paths |
| P6 | Async import via outbox + worker; bounded batch sizes | Large CSV does not block HTTP |

### Estimated effort

| ID | Effort |
|---|---|
| P1 + P2 | 2–3 days (same as Code Quality Q1) |
| P3 | 1–2 days |
| P4 | 2–3 days (harness + baselines) |
| P5 | 1–2 days (with P3/P4) |
| P6 | Core Sprint-06 import track (4–6 days of the sprint) |

### Which Sprint

| ID | Sprint |
|---|---|
| **All P1–P6** | **Sprint-06** — non-negotiable for M3 |

**Path to ≥8.0:** Prove P1–P5 with evidence; ship P6 as the import backbone.

---

## 5. Documentation — 6.5 / 10

### Why this score

Normative docs (`00`–`11`, UI specs, ADRs, sprint pack) are unusually complete for this stage. Score was ~5.0 when README still claimed “Sprint-02 current” and all sprint Status fields said “Ready for planning.” Mid-audit hygiene raised the score; remaining debt is Next.js ADR absence, residual Vite examples, OpenAPI not generated from code, and skeletal runbooks.

### Evidence from the repository

| Evidence | Path / artifact |
|---|---|
| Hygiene applied | `README.md`; Sprint-01…05 Status; `docs/08` Next.js note; this plan’s parent audit |
| Rich normative set | `docs/02`–`06`, `docs/ui/**`, `docs/sprints/**`, `docs/reviews/**` |
| No Next.js ADR | `docs/adr/` (cookie, outbox, prisma raw SQL, money — no web framework ADR) |
| Vite examples remain deeper in folder doc | `docs/08-folder-structure.md` |
| OpenAPI not first-class artifact | Contracts Zod exist; no generated OpenAPI publish step |
| Runbook skeletons | e.g. `docs/runbooks/deployment.md` “Sprint-02 skeleton” |
| Import handoff exists | `docs/sprints/Sprint-06-import-handoff.md` |

### What must be improved

| ID | Improvement | Acceptance signal |
|---|---|---|
| D1 | ADR-000x Next.js App Router | Accepted ADR linked from README / `docs/08` |
| D2 | Replace remaining Vite trees in `docs/08` with App Router tree | Single coherent web layout story |
| D3 | Generate or publish OpenAPI subset for shipped `/v1` surfaces | Artifact in CI or `docs/api/` |
| D4 | Refresh platform runbooks (deploy/restore/incident) past “Sprint-02 skeleton” | Versioned runbooks used in staging demo |
| D5 | Keep sprint Status + Implementation/Review links current each exit | Process checklist |
| D6 | Record staging demo + T05-12 / M3 evidence templates | Filled runbook or review appendix |

### Estimated effort

| ID | Effort |
|---|---|
| D1 | 0.5 day |
| D2 | 1–1.5 days |
| D3 | 2–3 days (tooling choice + first publish) |
| D4 | 1–2 days |
| D5 | Continuous (≤0.25 day/sprint) |
| D6 | 0.5–1 day process |

### Which Sprint

| ID | Sprint |
|---|---|
| D1, D2, D5, D6 | **Sprint-06** week 0–1 |
| D4 | **Sprint-06** as staging demo prep |
| D3 | **Sprint-06** stretch or **Sprint-07** if import capacity is tight |

**Path to ≥8.0:** Complete D1, D2, D4, D5, D6; D3 strongly preferred before pilots.

---

## Consolidated backlog by Sprint

### Sprint-06 (M3 — must absorb)

| Priority | IDs | Theme | Effort band |
|---|---|---|---|
| P0 | P1, P2, Q1 | Org-wide units API + kill fan-out | 2–3 d |
| P0 | S2, P6 | S3 SDK + async import pipeline | 6–9 d combined with feature work |
| P0 | P3, P4, P5 | 10k seed + perf gate + indexes | 4–7 d |
| P0 | S5 | Import/export permission keys | 1 d |
| P1 | S1, A4 | Composite tenant FK expand | 2.5–5 d |
| P1 | Q3 | Property grant admin UX | 3–4 d |
| P1 | A1, A2, D1, D2, D5, D6 | ADR + docs hygiene + evidence | 2–4 d |
| P2 | A3, A5, Q2, Q6 | Module shape + conventions | absorbed / small |

**Sprint-06 capacity note:** Two-week sprint cannot do everything above at full depth with one engineer. Sequence **week 1:** S2, P1/P2/Q1, S5, D1; **week 2:** import wizard/worker (P6), P3/P4, S1 or Q3 as capacity allows. Defer Q4/Q5/D3 explicitly if needed.

### Sprint-07 (quality / auth harden — after M3 evidence)

| IDs | Theme |
|---|---|
| Q4, Q5 | Permission-filtered nav + browser e2e |
| S3, S4 | Redis rate limit + MFA recovery |
| D3 | OpenAPI publish (if deferred) |
| Residents domain start | Only if M3 Conditional Go exit met |

### Sprint-08+

| IDs | Theme |
|---|---|
| A3 expansion | Domain ports for leasing |
| P3-style seeds | Lease/billing volume tests later |
| S6 | Pen-test / WCAG (Sprint-20–21 / Phase 9) |

---

## Target score trajectory

| Gate | Architecture | Code Quality | Security | Performance | Documentation |
|---|---:|---:|---:|---:|---:|
| Now (audit) | 7.5 | 7.0 | 8.0 | 5.5 | 6.5 |
| End Sprint-06 (M3 claimable) | ≥8.0 | ≥7.5 | ≥8.5 | ≥8.0 | ≥7.5 |
| End Sprint-07 | ≥8.5 | ≥8.0 | ≥8.5 | ≥8.0 | ≥8.0 |

M3 should **not** be claimed until Performance ≥8.0 **and** Sprint-06 acceptance criteria (import + 10k evidence + staging demo) are met — per Mid-Project-Audit Go/No-Go.

---

## Risks if improvements are skipped

| Skipped | Consequence |
|---|---|
| P1/P2 / Q1 | Portfolio UI fails or lies at pilot scale; M3 false |
| S2 / P6 | Import without durable artifacts; support hell |
| S1 | Cross-tenant data corruption possible under app bugs |
| Q3 | PM-scoped import untestable by operators |
| D1/D2 | Onboarding engineers reintroduce Vite patterns |
| Q5 | Regressions in org switch / scope only found in production |

---

## References

- [Mid-Project-Audit.md](./Mid-Project-Audit.md)
- [Sprint-05-Review.md](./Sprint-05-Review.md)
- [Sprint-06.md](../sprints/Sprint-06.md)
- [Sprint-06-import-handoff.md](../sprints/Sprint-06-import-handoff.md)
- [dependency-map.md](../dependency-map.md)
- [CODING_RULES.md](../../CODING_RULES.md)
