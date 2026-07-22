# Sprint-01 — Repository and Delivery Foundation

**Sprint ID:** Sprint-01  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 1 · Phase 1 toward **M1**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md)  
**Duration:** 2 weeks (program calendar: weeks 1–2 after Sprint 0 / M0)  
**Status:** Ready for planning  
**Builds on:** Sprint 0 / **M0** (charter, ADRs stubs, provider kickoff)—no separate sprint file; see [10-development-roadmap.md](../10-development-roadmap.md)

---

## Goal

Establish a production-shaped monorepo with automated CI/CD, secure configuration, health/telemetry, and a deployable empty vertical slice (web → API) so every later feature ships through the same delivery path.

---

## Business Value

- Removes “works on my machine” risk before business modules multiply.
- Creates a releasable skeleton that can be deployed, observed, and rolled back—reducing later launch cost.
- Unlocks Sprint-02 data/ops work and all subsequent independently deployable increments.
- Demonstrates delivery credibility to stakeholders with a traced request in a real environment.

---

## Scope

### In scope

- `pnpm` monorepo workspace conventions and package boundaries per [08-folder-structure.md](../08-folder-structure.md) and [09-coding-standard.md](../09-coding-standard.md).
- Applications: web (React/TypeScript), API (NestJS), worker stub.
- CI pipelines: typecheck, lint, unit/component tests, dependency/license scan, secret scan, build, container scan baseline.
- Typed runtime configuration validated at startup.
- Health/readiness endpoints and structured logging with correlation IDs.
- Baseline metrics and distributed tracing for a sample web→API call.
- Disposable local/test dependencies and documented developer setup.
- Continuous deploy of the empty slice to the **development** environment.

### Out of scope

- Prisma schema beyond a minimal placeholder (Sprint-02).
- Authentication, Organizations, RBAC (Sprint-03+).
- Business domains (portfolio, leasing, finance, maintenance).
- Staging restore rehearsal exit for **M1** (completes in Sprint-02).
- Payment-provider integration or KYC completion (started as external track only).

### Prerequisite (Sprint 0 / M0)

If M0 is not yet approved, complete within this sprint’s first days without expanding engineering scope:

- MVP charter, vocabulary, permission matrix draft, provider selections, and ADR stubs for money/cookie/outbox/Prisma+raw SQL policy.

---

## Features

1. Monorepo bootstrap with enforced import boundaries.
2. Web shell placeholder (design-token-ready, no business nav).
3. API health and sample authenticated-agnostic ping endpoint.
4. Worker process skeleton that boots and reports health.
5. CI quality gates matching coding-standard minimums (`typecheck`, `lint`, `unit`, `sca`).
6. Development environment provisioning and first automated deploy.
7. Observability baseline: logs, correlation ID, trace of web→API.
8. Developer onboarding README for local run (documentation only).

---

## User Stories

1. **As an engineer**, I can clone the repo, install with `pnpm`, and run web/API locally with documented commands so I am productive on day one.
2. **As an engineer**, every pull request runs typecheck, lint, unit tests, and SCA/secret scans so unsafe changes cannot merge unnoticed.
3. **As an engineering lead**, a merge to the default branch deploys a traced web→API request to development so delivery automation is proven.
4. **As an on-call engineer**, health endpoints and structured logs with correlation IDs let me confirm the empty slice is alive.
5. **As a product owner**, I can see a demo of the deployed empty vertical slice so platform progress is visible before domain features.

---

## Database Changes

| Change | Detail |
|---|---|
| None authoritative | No Organization-owned business tables. |
| Optional placeholder | Empty Prisma project or `schema.prisma` stub **without** production migrations that imply domain model (full migration workflow is Sprint-02). |
| Local deps | Disposable Postgres/Redis containers for future integration tests may be provisioned but unused by domain logic. |

No tenant-scoped data, no RLS assumptions as primary control, no money tables.

---

## API Changes

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Liveness | Public |
| `GET` | `/ready` | Readiness (config loaded; deps optional/soft) | Public |
| `GET` | `/v1/meta/version` | Build SemVer + git SHA | Public or internal |
| `GET` | `/v1/meta/ping` | Sample JSON ping for web→API demo | Public (temporary; replaced by auth in Sprint-03) |

**Shared protocol (stubs only):** error envelope shape documented to match [04-api-specification.md](../04-api-specification.md) Problem Details direction; full pagination/idempotency/audit envelopes land in Sprint-02.

**Forbidden:** `X-Tenant-ID` or any caller-selected Organization header pattern.

---

## UI Changes

| Screen / surface | Change |
|---|---|
| App shell placeholder | Minimal layout using [design-system.md](../design-system.md) tokens (typography/color CSS variables only). |
| Health/status page (dev) | Optional simple page calling `/v1/meta/ping` and showing version. |
| Auth screens | Not built. |
| Staff navigation / IA | Not built. |

No business screens from `docs/ui/`. Align visual foundations only; do not implement full design-system component library.

---

## Permissions

| Item | Sprint-01 stance |
|---|---|
| RBAC | Not implemented. |
| Public health/meta | Allowed. |
| Business endpoints | None exist. |
| Platform vs Organization | Not applicable. |

Permission matrix remains a **document** (from M0); server enforcement begins in Sprint-04 (**M2**). Sprint-03 establishes identity/membership only.

---

## Validation Rules

1. Configuration fails fast at startup if required env vars are missing or invalid.
2. CI fails on TypeScript errors, ESLint warnings-as-errors per standard, and secret findings.
3. Lockfile must be committed; install is reproducible.
4. Package import boundaries reject forbidden cross-package imports.
5. Health endpoints never expose secrets, connection strings, or stack traces.
6. Correlation ID is accepted from inbound header or generated; returned on response.
7. SemVer/`0.y.z` pre-GA versioning per [project-roadmap.md](../project-roadmap.md) versioning strategy.

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T01-01 | Fresh clone + documented local setup | Web and API start successfully |
| T01-02 | `pnpm typecheck` / `lint` / `unit` on main | Pass |
| T01-03 | PR with intentional secret-like string | Secret scan fails |
| T01-04 | Forbidden cross-package import | Boundary check fails |
| T01-05 | `GET /health` | 200, no sensitive fields |
| T01-06 | `GET /ready` with missing required config | Non-ready status |
| T01-07 | Web calls `/v1/meta/ping` | JSON OK; trace/log shows shared correlation ID |
| T01-08 | CI deploy to development | Smoke check succeeds |
| T01-09 | Container/build artifact | Builds reproducibly from SHA |

---

## Acceptance Criteria

1. Monorepo structure matches agreed package boundaries.
2. CI gates required by coding standard run on every PR; branch protection covers at least `typecheck`, `lint`, `unit`, `sca`.
3. Development deploy is automatic from the default branch.
4. Demo: a traced web→API request is observable in development logs/traces.
5. Developer setup documentation is complete enough for a new engineer without tribal knowledge.
6. No business domain code that bypasses future Organization isolation patterns.
7. M0 is approved or remaining open decisions have named owners and dates (no silent assumptions).

**Milestone contribution:** Progress toward **M1** (M1 exit completes in Sprint-02).

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Over-building framework before domain | Schedule waste | Strict out-of-scope; empty slice only |
| CI gate set too weak | Later rework | Adopt coding-standard minimum gates now |
| Cloud account / registry delay | Cannot demo deploy | Parallelize account setup from Sprint 0; local demo fallback only as temporary |
| Tooling bikeshedding | Slip | Freeze toolchain choices in ADR within first 3 days |
| Skipping M0 decisions | Wrong boundaries later | Block domain work; track decision owners |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| M0 charter / MVP boundaries | Hard (intent) | Yes |
| Cloud + container registry + CI runner | Hard | For deploy demo |
| Node/`pnpm` toolchain versions | Hard | Yes |
| Observability backend (or compatible local) | Soft | Traces may be exporter-optional initially |
| Sprint-02 | Downstream | Consumes this foundation |
| External: PSP KYC kickoff | Parallel track | Not blocking Sprint-01 demo |

---

## Deliverables

1. Monorepo with web, API, worker packages and CI workflows.
2. Development environment deployment of empty vertical slice.
3. Health/readiness/version/ping endpoints.
4. Structured logging + correlation ID + baseline telemetry.
5. Developer setup documentation.
6. ADR stubs / links for platform decisions (cookie topology, outbox, Prisma policy) as documentation artifacts.
7. Sprint demo recording or live demo checklist.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Monorepo + package boundaries | 2–3 days |
| CI pipelines + branch protection | 2–3 days |
| Config, health, logging, tracing | 2 days |
| Local DX + docs | 1–2 days |
| Dev deploy + demo hardening | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

Staffing assumption: platform-capable engineer + FE/BE pair; Eng lead review.

---

## Definition of Done

1. Acceptance criteria met and demonstrated in **development**.
2. Code follows repository boundaries and [09-coding-standard.md](../09-coding-standard.md).
3. CI quality gates pass; required reviews complete.
4. No unresolved critical/high defects in delivery tooling.
5. Documentation updated (setup, env vars, pipeline overview).
6. “Code complete” without deploy/demo is **not** done.
7. Handoff notes for Sprint-02 (Prisma, staging, outbox) captured in backlog.
