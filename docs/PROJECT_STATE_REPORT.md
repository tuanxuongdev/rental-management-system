# Project State Report

**Report ID:** RPM-PROJECT-STATE-REPORT  
**Generated:** 2026-07-24  
**Method:** Docs-as-truth reconstruction from repository only (no chat memory). Sources: `README.md`, `AGENTS.md`, `CLAUDE.md`, `CODING_RULES.md`, `docs/**` (roadmap, dependency map, sprints, reviews, ADRs, runbooks, normative design docs), plus cross-check against implemented tree (`apps/`, `packages/`, `prisma/`).  
**Note:** `docs/PROJECT_STATE.md` does **not** exist in this repository.

---

## Documentation ↔ implementation inconsistencies (read before any coding)

| # | Severity | Finding |
|---|---|---|
| **I1** | **High (doc drift)** | Root [`README.md`](../README.md) still states **Sprints 01–05 are implemented** and **next = Sprint-06**. Sprint files and reviews show **Sprint-06 and Sprint-07 are implemented and reviewed**; next planned increment is **Sprint-08**. |
| **I2** | **High (doc drift)** | [`docs/reviews/Mid-Project-Audit.md`](./reviews/Mid-Project-Audit.md) (2026-07-23) freezes state at end of Sprint-05, Conditional Go for Sprint-06, and **explicitly does not authorize Sprint-07+**. Same calendar day / subsequent commits delivered Sprint-06 and Sprint-07. Treat the audit as **historical mid-Phase-3**, not current program position. |
| **I3** | **Medium** | Milestone accounting: Mid-Project Audit marks **M3 🟡 in progress** and **M4+ ⏸**. Implementation reviews grant **Conditional Go** for M3 technical path and Sprint-07 (Phase 4 start), but **stakeholder M3 sign-off / staging 10k evidence remain open**. Do not claim full **M3** or **M4**. |
| **I4** | **Medium** | [`docs/sprints/Sprint-06.md`](./sprints/Sprint-06.md) / [`Sprint-07.md`](./sprints/Sprint-07.md) Status = “Implemented …” while Sprint-01…05 say “Implemented / Reviewed”. Reviews exist for 06/07; status strings are inconsistent. |
| **I5** | **Medium (Sprint-08 blocker)** | [`docs/adr/0004-money-representation.md`](./adr/0004-money-representation.md) is still **Proposed (stub)**. Sprint-08 requires money ADR **approved** before rent/deposit columns. |
| **I6** | **Low–Medium** | Sprint-07.md still names permission `residents.pii.reveal`; catalog/code use `residents.sensitive_data.view` ([Sprint-07-Review](./reviews/Sprint-07-Review.md) H10). |
| **I7** | **Low** | [`docs/08-folder-structure.md`](./08-folder-structure.md) still contains deeper Vite SPA examples; [`ADR-0005`](./adr/0005-nextjs-app-router.md) accepts **Next.js App Router** as the implemented stack. |
| **I8** | **Expected (scope)** | [`docs/04-api-specification.md`](./04-api-specification.md) / [`03-database-design.md`](./03-database-design.md) describe full MVP surface (leases, billing, payments, …). **Implemented code** stops at platform → identity/RBAC → inventory/import → residents/documents. No `leasing` module or schema yet. |
| **I9** | **Low** | Product SemVer in repo is `0.0.0` (root + apps); roadmap pre-GA scheme is `0.y.z`. API path major remains `/v1`. |

**Rule for agents:** Resolve doc drift (especially I1/I2) or obtain explicit product acceptance before treating README/Mid-Project Audit as current “next task.” Prefer sprint Status + latest sprint reviews + code evidence.

---

## Current Milestone

| Field | Value |
|---|---|
| **Program phase** | **Phase 4 started** (Residents/Documents via Sprint-07) toward **M4** (Lease lifecycle) |
| **Last completed engineering sprint** | **Sprint-07** — Resident Management (Implemented + Review Conditional Go → Sprint-08) |
| **Next planned sprint** | **Sprint-08** — Lease Creation and Activation (`Status: Ready for planning`) |
| **Milestone claims** | **M1** technical ✅ (S01–S02) · **M2** technical ✅ (S03–S04) · **M3** 🟡 **conditional technical** (S05–S06; staging 10k + human sign-off open) · **M4** ⏸ not started (no leases) |
| **Product version channel** | Pre-GA `0.0.0` (not GA `1.0.0`) |

Roadmap critical path next node: **lease draft/activate (Sprint-08)** after inventory + residents.

---

## Completed Sprints

| Sprint | Name | Status (sprint file) | Review |
|---|---|---|---|
| **01** | Repository and Delivery Foundation | Implemented / Reviewed | [Sprint-01-Review](./reviews/Sprint-01-Review.md) — Approve |
| **02** | Data and Operational Foundation | Implemented / Reviewed | [Sprint-02-Review](./reviews/Sprint-02-Review.md) — Approve with conditions |
| **03** | Authentication and Invitations | Implemented / Reviewed | [Sprint-03-Review](./reviews/Sprint-03-Review.md) — Approve with conditions |
| **04** | Authorization and Organization Administration | Implemented / Reviewed | [Sprint-04-Review](./reviews/Sprint-04-Review.md) — Approve with conditions (**M2** technical) |
| **05** | Property and Unit Inventory | Implemented / Reviewed | [Sprint-05-Review](./reviews/Sprint-05-Review.md) — Approve with conditions |
| **06** | Bulk Inventory Import and Scale Baseline | Implemented | [Sprint-06-Review](./reviews/Sprint-06-Review.md) — Approve with conditions / Conditional M3 & Go → S07 |
| **07** | Resident Management | Implemented | [Sprint-07-Review](./reviews/Sprint-07-Review.md) — Approve with conditions / Conditional Go → S08 |

**Authored but not started:** Sprint-08 … Sprint-12 (`Ready for planning`). Roadmap Sprints 13–24 are **not** authored as sprint files ([SPRINT_REVIEW.md](./sprints/SPRINT_REVIEW.md)).

---

## Approved Reviews

| Artifact | Date | Score | Decision |
|---|---|---:|---|
| Sprint-01 Review | 2026-07-22 | 85/100 | **Approve** |
| Sprint-02 Review | 2026-07-22 | 86/100 | **Approve with conditions** |
| Sprint-03 Review | — | 8.2/10 | **Approve with conditions** |
| Sprint-04 Review | — | 8.4/10 | **Approve with conditions** |
| Sprint-05 Review | — | 8.3/10 | **Approve with conditions** |
| Mid-Project Audit | 2026-07-23 | ~7.0/10 overall | **Conditional Go** for Sprint-06 planning *(superseded as “current next” by S06/S07 delivery)* |
| Mid-Project Improvement Plan | 2026-07-23 | Planning only | P0/P1 largely assigned to Sprint-06 |
| Sprint-06 Review | 2026-07-23 | 8.1/10 | **Approve with conditions** / Conditional Go → Sprint-07 |
| Sprint-07 Review | 2026-07-23 | 8.0/10 | **Approve with conditions** / Conditional Go → Sprint-08 |
| Sprint Pack Review (01–12 docs) | 2026-07-22 | N/A | Pack coherent through S12; **not** full GA path |

Supporting implementation summaries: `docs/reviews/Sprint-0{2,3,4,5,6,7}-Implementation.md`.

---

## Current Architecture Status

**Shape:** pnpm modular monolith — `apps/web` (Next.js 15 App Router), `apps/api` + `apps/worker` (NestJS), `packages/{ui,contracts,config,testing}`, split Prisma under `prisma/schema/`.

**Implemented API modules:** `meta`, `identity`, `tenancy`, `audit`, `inventory`, `parties`, `imports`, `residents`, `documents`.

**Implemented web features:** `admin`, `identity`, `inventory`, `parties`, `imports`, `platform`, `residents`, `documents`.

**Not started:** `leasing`, billing, payments, maintenance, reporting, resident portal depth, migration rehearsals.

**Cross-cutting (landed):**

- Organization isolation from JWT/session (no caller `X-Tenant-ID` / `X-Organization-ID`)
- Deny-by-default RBAC + property scope; isolation suite in CI
- Outbox + worker (import commit path); idempotency patterns
- RFC 9457 problem+json; memory access tokens + HttpOnly refresh (ADR-0001)
- S3-compatible storage client used for import/document artifacts (Sprint-06/07)
- ADR-0005 Next.js accepted; ADR-0002 outbox; ADR-0003 Prisma/raw SQL policy; ADR-0004 money **still stub**

**Architecture residuals:** thin Nest `domain/` ports in older modules (improved in imports/residents/documents); API↔worker import processor duplication; residual Vite examples in docs/08; no Playwright e2e; OpenAPI not fully generated from code.

---

## Database Version

| Item | Value |
|---|---|
| **ORM** | Prisma **6.x** (`^6.1.0`) |
| **Design doc** | RPM-DB-03 — Production design baseline ([03-database-design.md](./03-database-design.md)) |
| **Latest applied migration (in repo)** | `20260726120000_sprint_07_residents_documents` |
| **Migration chain** | `…_init_platform` → `…_sprint_03_identity_tenancy_audit` → `…_sprint_04_rbac` → `…_sprint_05_portfolio_inventory` (+ partial uniques) → `…_sprint_06_imports` → `…_sprint_06_composite_fks_indexes` → `…_sprint_07_residents_documents` |
| **Schema domains present** | `platform`, `identity`, `tenancy`, `rbac`, `audit`, `inventory`, `parties`, `imports`, `residents`, `documents` |
| **Schema domains absent** | Leases/allocations/occupancy, meters/billing/ledger, payments, maintenance, etc. |

---

## API Version

| Item | Value |
|---|---|
| **HTTP path major** | **`/v1`** (implemented routes under `/v1/...`; design doc also shows `/api/v1` gateway prefix) |
| **Contract baseline** | RPM-API-04 — Production contract baseline ([04-api-specification.md](./04-api-specification.md)) |
| **App / meta version** | **`0.0.0`** (`APP_VERSION` default; `GET /v1/meta/version`) |
| **Implemented surface (summary)** | Health/ready; meta; auth/me/invitations/MFA challenge; org admin (members, roles, settings, property grants); portfolio inventory/parties; imports/exports/operations; residents/waitlist/DNR; documents upload/scan/download |
| **Shared contracts package** | `@rpm/contracts` through Sprint-07 (`auth`, `rbac`, `inventory`, `parties`, `imports`, `residents`, `documents`, …) |

---

## Completed Features

**Platform / delivery (S01–S02)**  
Monorepo, CI quality gates (lint/typecheck/boundaries/isolation/SCA/scans), health/ready, Prisma migrate workflow, outbox/idempotency/scheduled_jobs skeletons, Compose + deploy-dev smoke, runbook skeletons.

**Identity & tenancy (S03–S04 / M2 technical)**  
Login/refresh/logout, invitations, memberships, org switch, deny-by-default permissions, system roles, property access grants, audit foundations, admin UI (users/roles/invitations/settings).

**Portfolio inventory (S05)**  
Property → Building → Unit → optional Bed; parties/owners/management agreements (ownership ≠ login); Portfolio UI; If-Match versioning; property-scoped PM queries.

**Import & scale (S06 / M3 technical backbone)**  
Inventory CSV import (template → dry-run → async commit → reject CSV), bulk unit status, governed export, Operations Center, org-wide units API + cursor UI, S3 artifacts, composite tenant FK expand (property path), grant admin UX, scale seed + list SLO harness (CI default &lt;10k).

**Residents & documents (S07 / Phase 4 start)**  
Resident profiles/contacts, duplicate detection (no auto-merge), waitlist, do-not-rent + audit, PII masking (`residents.sensitive_data.view`), document upload → scan stub → authenticated/S3 download, People nav (permission-filtered for these surfaces).

---

## Remaining Features

Ordered by roadmap / dependency map (not exhaustive of full API/UI catalogs):

| Horizon | Features |
|---|---|
| **Immediate (Sprint-08)** | Draft lease, terms/parties/allocations, GiST EXCLUDE / capacity locks, activation, lease list/detail/wizard UI, `lease.activated` outbox, money ADR finalize |
| **Sprint-09 (M4 exit)** | Move-in / renew / move-out, occupancy events, checkout evidence |
| **Sprint-10–13 (→ M5)** | Billing schedules/invoices/ledger, meters/utilities MVP, payments + PSP, reconciliation, financial soak |
| **Sprint-14–15 (→ M6)** | Maintenance, notifications, dashboards/MVP reports |
| **Sprint-16–24 (→ M7–M10)** | Migration rehearsals ×2, dual pilots, pen-test + 10k gate, cutover, GA |
| **Explicit non-MVP / post-GA** | Owner payouts/trust accounting, SSO/SCIM, native apps, marketplace, payment plans, e-sign, SMS consent, AI, microservices (see roadmap §4.3 / §6) |
| **Carryover hardening** | Staging M3 sign-off; true 10k SLO evidence; KMS identifier encryption; external AV worker; Redis rate limit; MFA recovery; Playwright e2e; OpenAPI publish; import kill/resume automation; ops metrics dashboards |

---

## Technical Debt

Prioritized from Mid-Project Audit/Improvement Plan and Sprint-06/07 reviews (open items):

| Priority | Item |
|---|---|
| **P0 / process** | Staging 10k seed + recorded list/search evidence; human **M3** demo sign-off |
| **P0 / Sprint-08 prep** | Finalize **ADR-0004** money representation before lease commercial columns |
| **P1** | Replace identifier encryption placeholder with KMS/vault; async malware scan + quarantine |
| **P1** | Worker kill/resume automation for import commit; extract shared API↔worker import processor |
| **P1** | `(tenant_id, membership_id)` composite FK on grants (property composites landed in S06) |
| **P1** | Search strategy beyond `ILIKE '%q%'` at 10k+ |
| **P2** | Redis-backed rate limiting; MFA recovery enrollment |
| **P2** | Browser e2e (login → org switch → scope); fuller permission-filtered Portfolio nav |
| **P2** | OpenAPI artifact from Nest/contracts; residual Vite trees in docs/08 |
| **P2** | README + Mid-Project Audit position refresh (this report’s I1/I2) |
| **P3** | Floors/rate-plan/amenity UI depth; OpenTelemetry maturity; mapping-preset UI |

---

## Known Risks

From [`project-roadmap.md`](./project-roadmap.md) §5, Mid-Project Audit, and Sprint-06/07 reviews:

1. **M3 overclaim** — technical import/scale exist; staging proof and stakeholder sign-off incomplete.  
2. **PII/document stubs** — reversible identifier “encryption”; sync MIME allowlist ≠ AV; production PII volume not privacy-ready.  
3. **Cross-org isolation** — still launch-blocking if regressions; composite FK defense-in-depth incomplete on some grant paths.  
4. **Lease double-booking (upcoming)** — GiST EXCLUDE / capacity locking is high-risk on critical path (Sprint-08).  
5. **Money/TZ/tax ADR lag** — blocks honest Sprint-08 commercial fields and later billing (R3/R9 class).  
6. **PSP KYC lead time** — external critical path for Phase 5 (start tracking now).  
7. **Legacy data quality** — import patterns help; full migration rehearsals still far (R2).  
8. **10k performance / search** — CI uses reduced scale; mid-string search unproven.  
9. **Doc drift** — README/audit lag causes wrong “next sprint” selection by agents (I1/I2).  
10. **Pack gap** — Sprint files only through 12; GA requires 13–24 not yet authored.

Non-waivable launch risks (roadmap): isolation failure, unexplained financial imbalance, RPO/RTO miss, unresolved critical/high security findings.

---

## Current Branch Status

| Field | Value |
|---|---|
| **Branch** | `main` |
| **Tracking** | `origin/main` — **in sync** (0 ahead / 0 behind) |
| **Working tree** | Clean (no uncommitted changes at report time) |
| **HEAD** | `db521df` — `feat: add residents and documents management features` |
| **Remote** | `git@github-tuanxuongdev:tuanxuongdev/rental-management-system.git` |
| **Feature branches** | None checked out; delivery appears merged to `main` |

---

## Recommended Next Task

**Primary (engineering):** Plan and kick off **[Sprint-08 — Lease Creation and Activation](./sprints/Sprint-08.md)** under the Sprint-07 Conditional Go, **after** (or in week-0 parallel with):

1. **Approve ADR-0004** (money storage/transport) — hard prerequisite for rent/deposit columns.  
2. Product acceptance of residual S07 stubs (KMS encryption, external AV) for pilot-only data **or** schedule hardening spikes.  
3. Prefer closing **M3 process evidence** (staging `SCALE_TEST_UNIT_COUNT=10000` + demo sign-off) so milestone accounting stays honest.

**Immediate hygiene (docs, no feature code):** Update `README.md` (and optionally annotate Mid-Project Audit as superseded) so agents do not restart Sprint-06.

**Do not start:** Sprint-09+ leasing lifecycle, billing, payments, or inventing APIs outside Sprint-08 scope.

---

## Confidence Level

| Area | Confidence | Notes |
|---|---|---|
| **Implemented sprint scope (S01–S07)** | **High** | Sprint files + implementation summaries + reviews + migrations/modules/contracts align |
| **Next sprint = Sprint-08** | **High** | Sprint-07 review Conditional Go; Sprint-08 Ready for planning; no leasing code |
| **Formal M1/M2/M3 stakeholder sign-off** | **Medium–Low** | Reviews cite process/staging evidence gaps; not evidenced as closed in-repo |
| **README / Mid-Project Audit currency** | **Low (as current truth)** | Explicitly stale vs S06/S07 — see inconsistencies I1/I2 |
| **Overall program position** | **Medium–High** | Engineering position clear; milestone/process claims must stay **conditional** |

**Overall confidence in this report as an engineering state snapshot: ~0.85.**  
Process/sign-off and README drift are the main uncertainty sources—not ambiguity about “what code exists.”
