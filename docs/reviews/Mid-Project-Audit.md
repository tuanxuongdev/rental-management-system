# Mid-Project Audit

**Audit ID:** RPM-AUDIT-MID-01  
**Audit date:** 2026-07-23  
**Auditor role:** Principal Software Architect  
**Scope:** Full repository health after Sprint-01…Sprint-05 (implemented + reviewed)  
**Normative baselines:** [`AGENTS.md`](../../AGENTS.md) · [`CODING_RULES.md`](../../CODING_RULES.md) · [`docs/`](../) (architecture, DB, API, UI, sprints, reviews, ADRs)  
**Method:** Docs-as-truth + codebase evidence; **no new business features** implemented during this audit  
**Doc hygiene applied:** README current-sprint drift; Sprint-01…05 Status fields; `docs/08-folder-structure.md` Next.js / migrations note (see §Documentation)

---

## Executive summary

The program has delivered a **credible modular-monolith foundation through Phase 3 inventory (Sprint-05)**: platform durability (M1), identity + deny-by-default RBAC + org isolation (M2), and Organization-scoped Property → Unit → Bed inventory with parties/ownership/agreements and Portfolio UI (progress toward M3).

Architecture and security posture are **strong for the current milestone**. The largest gaps before claiming **M3** are **scale/import readiness** (org-wide units API, S3 upload SDK, 10k seed/perf gates), **DB composite tenant FKs**, and **process/staging evidence**. Documentation had meaningful drift (README still said “Sprint-02 current”; sprint Status fields all “Ready for planning”); those were corrected in this audit.

**Sprint-06 recommendation: Conditional Go** — proceed with planning and kickoff only if the conditions in §Go / No Go are accepted.

---

## Scores

| Dimension | Score | Rationale |
|---|---:|---|
| **Architecture** | **7.5 / 10** | Modular monolith, domain modules, contracts package, and isolation rules align with docs. Thin `domain/` layers; Vite trees historically drifted in `docs/08` (now annotated). |
| **Code Quality** | **7.0 / 10** | Review-hardened Sprint-04/05 services; solid contracts + CI. Client units fan-out; incomplete feature folder shape; limited e2e. |
| **Security** | **8.0 / 10** | Fail-closed RBAC, org path 404, no tenant headers, memory access tokens + HttpOnly refresh, problem+json, isolation CI, Gitleaks/Trivy. Residual: composite FKs, in-memory rate limit, MFA recovery deferred, S3 stub. |
| **Performance** | **5.5 / 10** | Adequate for small portfolios. Units list N×fan-out and hard `limit: 100` truncation conflict with Sprint-06 10k SLOs; no perf harness yet. |
| **Documentation** | **6.5 / 10** *(was ~5.0 pre-hygiene)* | Normative docs are rich and generally coherent. Drift fixed in README / sprint Status / `docs/08` stack note. Remaining: no Next.js ADR; Vite example trees still present deeper in `docs/08`; OpenAPI not fully generated from code. |

**Overall program health (weighted): ~7.0 / 10** — Ready to plan Sprint-06 under conditions; **not** ready to claim M3.

---

## Architecture consistency

| Check | Verdict | Evidence |
|---|---|---|
| Monorepo `apps/*` + `packages/*` + `prisma/` | Pass | Matches `CODING_RULES.md` §4.1 |
| Next.js App Router web | Pass | `apps/web/src/app`, features under `features/*` |
| Nest modular monolith | Pass / Partial | Modules: `identity`, `tenancy`, `inventory`, `parties`, `audit`, `meta`. Controllers thin; missing per-module `domain/` ports |
| Worker outbox consumer | Pass | Sprint-02 pattern + tenant-context fail-closed |
| Contracts boundary | Pass | `@rpm/contracts` Zod schemas; no Nest/Prisma leakage |
| Vocabulary (Unit ≠ Room, Property Owner ≠ Org Owner) | Pass | API docs + UI copy + parties responses `grantsLoginAccess: false` |
| Cross-app imports | Pass | CI `pnpm boundaries` |

**Drift addressed:** `docs/08-folder-structure.md` now states Next.js is the implemented web stack and migrations live under `prisma/schema/migrations/`.

---

## Database consistency

| Check | Verdict | Notes |
|---|---|---|
| Sprint-02…05 migrations present | Pass | Platform → identity/tenancy/audit → RBAC → inventory/parties + review partial uniques |
| Soft-delete + active code uniqueness | Pass (post S05 review) | Partial unique indexes on properties/units/beds/buildings |
| Composite `(tenant_id, parent_id)` FKs | **Fail / open** | Single-column FKs; app filters mitigate — Sprint-05 Review H9 |
| Money / Decimal | Pass | Ownership % via Prisma `Decimal`; no JS float currency in inventory |
| Expand/migrate/contract discipline | Pass so far | No edited applied migrations observed |

---

## API consistency

| Check | Verdict | Notes |
|---|---|---|
| Org-scoped paths `/v1/organizations/{orgId}/…` | Pass | Inventory + parties + admin |
| Cursor pagination envelopes | Pass | Contracts + services |
| If-Match / version (428 / 412) | Pass (post S05 review) | `requireIfMatchVersion`, `throwVersionMismatch` |
| RFC 9457 problem+json | Pass | Global filter |
| No `/rooms`, no caller tenant headers | Pass | Guard + tests |
| Org-wide `GET /units` | **Gap** | Blocks clean 10k list UX (Sprint-06) |
| Import/export permission keys | **Not yet** | Expected in Sprint-06 |

---

## UI consistency

| Check | Verdict | Notes |
|---|---|---|
| Staff shell Admin + Portfolio | Pass | `app-shell.tsx` |
| Property scope selector | Pass | In-memory Zustand; resets on org switch |
| TanStack Query server state | Pass | Feature hooks |
| Tokens not in web storage | Pass | Auth store memory-only |
| Permission-filtered nav | Partial | Links always visible; server authz authoritative |
| Browser e2e | Gap | No Playwright/Cypress suite |
| Home inventory widget | Deferred | Acceptable thin Home |

---

## Multi-tenant design

| Control | Verdict |
|---|---|
| Org from session/JWT membership (not body/header) | Pass |
| Path org mismatch → 404 | Pass |
| Property Manager `property_access_grants` on queries | Pass (post S05 cursor fix) |
| Worker rejects null/mismatched tenant claims | Pass |
| Ownership/agreements never create memberships | Pass |
| DB-enforced tenant-complete FKs | Open (H9) |

---

## Security & RBAC

**Strengths**

- Deny-by-default `PermissionsGuard` (fails closed on org routes without `@RequirePermissions`).
- System roles + catalog seed; Property Manager ACTIVE with property maximum scope.
- Invitation role assignment gated; last-Owner protection; SoD triple hard-deny for non-Owners (Sprint-04 review).
- Isolation suite in CI (`pnpm isolation`).
- Secret scanning / container scan / SCA in CI.

**Residual risks**

| ID | Risk | Severity |
|---|---|---|
| S1 | Composite tenant FKs absent | High (defense in depth) |
| S2 | In-memory rate limiter (multi-instance weak) | Medium |
| S3 | MFA recovery enrollment deferred | Medium (carryover) |
| S4 | S3 client is key-convention stub (no PutObject) | High for Sprint-06 artifacts |
| S5 | No automated WCAG / pen-test yet | Expected pre-M9 |

---

## Performance

| Concern | Impact | Sprint-06 relevance |
|---|---|---|
| `useUnits` fans out `listUnits` per property when scope=`ALL` | Latency + silent truncation (`limit: 100`, flattened cursor) | **Must fix** before 10k demos |
| No 10k synthetic seed / SLO tests | Cannot prove M3 scale gate | Core Sprint-06 deliverable |
| Import without async worker + object storage | Timeouts / lost artifacts | Hard dependency |

---

## Folder structure & naming

- Implemented layout matches CODING_RULES more closely than historical Vite trees in `docs/08`.
- Feature modules use `components/`, `hooks/`, `utils/`; API clients centralized in `apps/web/src/lib/*-api.ts` (acceptable adapter pattern; not full CODING_RULES `features/*/api` shape).
- Prisma domain files: `identity`, `tenancy`, `rbac`, `inventory`, `parties`, `audit`, `platform` — good vocabulary alignment.
- Infrastructure currently Docker-centric; terraform/monitoring trees aspirational.

---

## Technical debt (prioritized)

| Priority | Item | Owner suggestion |
|---|---|---|
| **P0** | Wire real S3-compatible upload/download (or explicitly defer rejection CSVs with ADR) | Sprint-06 week 1 |
| **P0** | Org-wide cursor `GET …/units` + retire client fan-out | Sprint-06 week 1 |
| **P1** | Composite tenant FK expand migration | Sprint-06 or immediate hardening |
| **P1** | Property access grant admin UI/API for PM assignment | Sprint-06 early / ops workaround |
| **P1** | Next.js stack ADR (close Vite/Next ambiguity permanently) | Docs debt |
| **P2** | Redis-backed rate limiting; MFA recovery enrollment | Auth hardening |
| **P2** | Permission-filtered shell nav; browser e2e for org switch + scope | Quality |
| **P2** | Introduce module `domain/` ports as import/leasing grow | Architecture hygiene |
| **P3** | Floors/rate-plan/amenity UI depth; OpenTelemetry backend | Later phases |

---

## Documentation consistency

### Fixed in this audit

| File | Change |
|---|---|
| `README.md` | Current program position = Sprints 01–05 done; next = Sprint-06; API/docs map updated |
| `docs/sprints/Sprint-01.md` … `Sprint-05.md` | Status → Implemented / Reviewed (+ review links) |
| `docs/sprints/Sprint-06.md` | Status clarified as next planned increment |
| `docs/08-folder-structure.md` | Next.js is implemented stack; migrations path note |

### Remaining doc debt

- Deeper Vite SPA directory examples still appear later in `docs/08` — annotate progressively or replace with App Router tree in a dedicated docs PR.
- No ADR for Next.js App Router choice (flagged since Sprint-01 review).
- Runbooks still titled “Sprint-02 skeleton” in places — acceptable but should be versioned as platform runbooks mature.
- OpenAPI artifact not generated from Nest/contracts for Sprint-05 surface.

---

## Dependency health

| Area | Assessment |
|---|---|
| Workspace tooling | pnpm 9, Node 20+, Husky, commitlint, Vitest — healthy |
| Prisma 6.x | Current major; migrate workflow documented |
| Nest / Next 15 | Aligns with CODING_RULES |
| SCA / Trivy / Gitleaks | Present in CI |
| Hard Sprint-06 deps | Outbox/worker **ready**; **S3 SDK not ready**; Redis optional but recommended for rate limit/queues at scale |

---

## Build & test quality

| Gate | Assessment |
|---|---|
| `lint` / `typecheck` / `format` / `build` | Enforced in CI and local scripts |
| Unit tests | Contracts + platform/auth utilities; ~48 unit tests at last Sprint-05 review |
| Integration | Identity, RBAC isolation, inventory T05 + review cases, platform |
| Isolation CI job | Authz + inventory + worker tenant-context |
| Gaps | No web e2e; no 10k perf suite; limited a11y automation |

---

## Risks

1. **Claiming M3 too early** — inventory UI ≠ importable pilot at 10k with rejection CSVs.
2. **Import on S3 stub** — rejection artifacts / uploads fail in staging.
3. **Cross-tenant FK hole** — rare but severe if a bug skips `tenantId` filters.
4. **PM operations without grant admin UI** — support burden / SQL workarounds.
5. **Doc/process lag** — staging demos and T05-12 terminology sign-off not evidenced in-repo.
6. **Pack gap beyond Sprint-12** — GA still requires Sprints 13–24 (known program caveat).

---

## Recommendations

1. **Start Sprint-06 planning** under Conditional Go (below); sequence S3 + org-wide units API before wizard UX polish.
2. Schedule a **hardening spike** (½–1 day) for composite FK design note / expand migration plan.
3. Keep **isolation suite** green as a merge gate for all org-owned endpoints.
4. Author **ADR: Next.js App Router** and continue retiring Vite examples from `docs/08`.
5. Do **not** start residents/leases (Sprint-07+) until M3 evidence exists or dependency-map soft path is explicitly re-approved.
6. Treat Sprint-05 Review open items (H9–H10, M1–M3) as Sprint-06 entry backlog, not forgotten debt.

---

## Go / No Go for Sprint-06

### Decision: **Conditional Go**

Sprint-06 may proceed to **planning and controlled implementation** if **all** conditions hold:

| # | Condition | Why |
|---|---|---|
| 1 | Sprint-05 review critical/high **code** fixes are on the integration branch | Isolation integrity |
| 2 | Kickoff backlog includes **S3 SDK**, **org-wide units list**, **import permission keys**, **10k seed + perf gate** as week-1 commitments | Hard M3 dependencies |
| 3 | Product accepts PM grant admin as early Sprint-06 work **or** documents an operator workaround | T06 property-scope stories |
| 4 | Leadership does **not** treat M3 as already achieved; staging demo for import remains a Sprint-06 exit criterion | Honest milestone accounting |

### No-Go (delay execution) if

- Object storage cannot be provisioned in staging within the first week of Sprint-06, **and** rejection/upload artifacts remain in scope without an ADR deferral; or
- Stakeholders require a completed Sprint-05 staging terminology demo (T05-12) as a hard gate and it is still open with no waiver.

### Explicit non-claims

- This audit does **not** approve claiming **M3**.
- This audit does **not** authorize Sprint-07+ feature work.
- This audit does **not** waive composite FK hardening forever.

---

## Milestone position

```text
M0  … program baseline (process)
M1  … platform empty slice          ✅ technical (S01–S02)
M2  … org isolation + RBAC          ✅ technical (S03–S04)
M3  … pilot inventory importable    🟡 in progress (S05 done; S06 required)
M4+ … leasing / finance / …         ⏸ not started
```

---

## References

- Implementation: `docs/reviews/Sprint-01-Implementation.md` … `Sprint-05-Implementation.md`
- Reviews: `docs/reviews/Sprint-01-Review.md` … `Sprint-05-Review.md`
- Next sprint: `docs/sprints/Sprint-06.md` · handoff `docs/sprints/Sprint-06-import-handoff.md`
- Program: `docs/project-roadmap.md` · `docs/dependency-map.md` · `docs/10-development-roadmap.md`
