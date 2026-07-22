# Sprint-02 — Data and Operational Foundation

**Sprint ID:** Sprint-02  
**Roadmap alignment:** [10-development-roadmap.md](../10-development-roadmap.md) Sprint 2 · Phase 1 exit **M1**  
**Program references:** [project-roadmap.md](../project-roadmap.md) · [dependency-map.md](../dependency-map.md) · [03-database-design.md](../03-database-design.md)  
**Duration:** 2 weeks  
**Status:** Ready for planning  
**Builds on:** [Sprint-01.md](./Sprint-01.md)

---

## Goal

Complete the production-shaped data and operations baseline—Prisma migrations, Organization-aware repository patterns, Redis/outbox/idempotency skeletons, API envelopes, staging deploy, and a successful non-production restore rehearsal—so Sprint-03 can add identity on a durable platform (**M1**).

---

## Business Value

- Makes persistence, async work, and recovery real before multi-tenant business data exists.
- Prevents later modules from inventing incompatible error, pagination, and idempotency conventions.
- Proves staging and backup/restore early, reducing GA recoverability risk (RPO/RTO targets).
- Delivers **M1**: an empty vertical slice that deploys automatically to development **and** staging.

---

## Scope

### In scope

- Prisma schema organization and migration workflow (split schema approach per folder structure).
- Transaction helpers and **Organization-aware repository patterns** (every future org-owned row carries `tenant_id`; repositories require org context).
- Platform tables needed for runtime durability (no business inventory/lease/finance yet):
  - `outbox_events`, `processed_messages`, `scheduled_jobs`, `idempotency_keys` (as specified in database design).
- Managed PostgreSQL, Redis, S3-compatible bucket wiring in staging.
- Queue/outbox baseline: publish from DB transaction; worker consumes idempotently (skeleton handlers only).
- API shared protocol: RFC 9457-aligned errors, cursor pagination envelope, `Idempotency-Key` middleware stub, audit/event envelope shapes.
- Integration-test infrastructure against real PostgreSQL (and Redis-compatible) services in CI.
- Production-like **staging** deployment.
- Runbook skeletons: incident, migration, restore, deployment.
- Non-production **backup restore rehearsal**.

### Out of scope

- Users, sessions, Organizations, memberships, RBAC (Sprint-03/04).
- Property/Unit/Bed and all business domains.
- Real billing/payment processors.
- Full audit_events product UI.
- Treating Redis as source of truth for business events (forbidden).

---

## Features

1. Prisma migrate workflow with CI migrate checks / drift detection baseline.
2. Organization-context type and repository base that **refuses** queries without org scope for tenant-owned models (platform tables excepted).
3. Outbox writer + worker consumer loop with `processed_messages` dedupe.
4. Idempotency key store middleware (persist key hash; conflict on body mismatch)—wired on a sample mutating meta endpoint only.
5. Shared API error/pagination/idempotency contracts published for FE consumption.
6. Staging environment parity checklist (secrets, networking, observability).
7. Backup → restore → smoke test rehearsal in non-production.
8. S3 client wrapper with Organization-scoped key prefix convention (no uploads UI yet).

---

## User Stories

1. **As a backend engineer**, I can add a Prisma migration and apply it safely in CI and staging so schema changes are reproducible.
2. **As a backend engineer**, I cannot accidentally query tenant-owned data without Organization context so isolation is structural.
3. **As a platform engineer**, an outbox row written in a DB transaction is consumed exactly once by the worker so async work survives Redis loss.
4. **As an API consumer**, errors and pagination follow one envelope so clients do not special-case each module.
5. **As an on-call engineer**, I can follow a restore runbook skeleton and complete a non-production restore rehearsal.
6. **As an engineering lead**, staging hosts the same empty slice as development so **M1** is met.

---

## Database Changes

| Table / object | Purpose |
|---|---|
| `outbox_events` | Transactional outbox; source of truth for business/async events |
| `processed_messages` | Consumer idempotency / dedupe |
| `scheduled_jobs` | Durable job scheduling metadata (skeleton) |
| `idempotency_keys` | API idempotency records (org/actor/route scoped when auth exists; platform-scoped sample for now) |
| Migration history | Prisma migration tables |
| Extensions (prep) | Document intent for later `btree_gist` (not required until leasing) |

**Patterns established (no domain tables yet):**

- Integer/`cuid` ID conventions per schema standards.
- `createdAt` / `updatedAt` on platform tables.
- Composite org-scoped FK discipline documented for upcoming modules.
- Money: document `NUMERIC(19,4)` standard—no money columns this sprint.

**Explicitly deferred tables:** `tenants`, `users`, `user_sessions`, inventory, leases, invoices, etc. (Sprint-03+).

---

## API Changes

| Method | Path | Description | Auth |
|---|---|---|---|
| `GET` | `/health` | Liveness (retain) | Public |
| `GET` | `/ready` | Readiness now checks DB (and optionally Redis) | Public |
| `GET` | `/v1/meta/version` | Build info | Public/internal |
| `GET` | `/v1/meta/pagination-example` | Empty cursor page envelope sample | Public/internal |
| `POST` | `/v1/meta/idempotent-echo` | Sample mutating route requiring `Idempotency-Key` | Public/internal (temporary) |
| `GET` | `/v1/operations` or `/v1/meta/operations` | Skeleton list for future Operations Center (empty) | Internal |

**Contract rules introduced:**

- Problem Details error responses (`type`, `title`, `status`, `detail`, `instance`, stable `code` when applicable).
- Cursor pagination fields: `data`, `nextCursor`, `limit` (defaults aligned with API spec: default 25, max 100).
- `Idempotency-Key` required on designated mutating routes; replay returns stored response; body mismatch → conflict.
- No `X-Tenant-ID` header support.

OpenAPI skeleton generation may start from these envelopes (documentation/CI contract check).

---

## UI Changes

| Screen / surface | Change |
|---|---|
| Dev status page | Show readiness including DB status; version; optional idempotent echo demo control (dev-only). |
| Design tokens | Continue token wiring; no staff IA. |
| Operations Center UI | Not built (API skeleton only). |
| Auth / admin UI | Not built. |

Keep UI minimal; prefer API + staging proof over frontend expansion.

---

## Permissions

| Item | Sprint-02 stance |
|---|---|
| Endpoints | Meta/health only; no org-owned resources. |
| Repository rule | Tenant-owned model access requires org context type (compile-time/runtime guard). |
| S3 keys | Prefix convention `org/{organizationId}/...` documented; no public buckets. |
| Worker | Runs with explicit org/actor context on messages when present; skeleton jobs are platform-scoped. |

---

## Validation Rules

1. Migrations are forward-only, immutable, and applied in CI before tests.
2. Repository helpers reject tenant-owned queries without Organization id.
3. Outbox event insert and business write share one DB transaction (pattern proven with a no-op sample write if needed).
4. Worker crash mid-handler does not duplicate side effects when retried (`processed_messages`).
5. Idempotency keys TTL/hash behavior matches API specification intent.
6. `/ready` fails if PostgreSQL is unreachable.
7. Secrets never logged; config redaction filters in place.
8. Redis flush must not lose outbox intent (prove by deleting Redis and still processing pending outbox rows).

---

## Test Cases

| ID | Case | Expected |
|---|---|---|
| T02-01 | Apply migrations on empty DB | Success; platform tables exist |
| T02-02 | CI integration test boots Postgres | Migrations + sample repo test pass |
| T02-03 | Repository call without org context on tenant-owned stub | Hard failure |
| T02-04 | Write outbox in transaction; worker processes | Exactly one process record |
| T02-05 | Re-deliver same message | No duplicate side effect |
| T02-06 | Flush Redis; pending outbox remains processable | Events still drain from DB |
| T02-07 | Idempotent POST replay same key+body | Same response; single logical effect |
| T02-08 | Idempotent POST same key different body | Conflict error |
| T02-09 | Cursor pagination envelope on example | Contract schema valid |
| T02-10 | Staging deploy smoke | Health/ready/version OK |
| T02-11 | Backup restore rehearsal | Restored DB passes smoke; runbook followed |
| T02-12 | `/ready` with DB down | Not ready |

---

## Acceptance Criteria

1. Prisma migration workflow is the only supported schema change path.
2. Organization-aware repository pattern is documented and enforced for tenant-owned models.
3. Outbox + worker + `processed_messages` baseline operates in staging.
4. Shared API error, pagination, and idempotency envelopes are implemented and tested.
5. Integration tests run in CI against real PostgreSQL.
6. Staging deployment matches development empty slice.
7. Non-production restore rehearsal succeeds and is recorded.
8. Runbook skeletons exist for incident, migration, restore, and deployment.
9. **Milestone M1 achieved:** production-shaped empty vertical slice deploys automatically to development and staging.

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Treating Redis as authoritative queue | Lost business events | Outbox is SoT; Redis loss test T02-06 |
| Premature domain schema | Costly rework | Only platform durability tables |
| Staging ≠ production topology | False confidence | Parity checklist; managed services |
| Restore rehearsal skipped | GA recoverability risk | Explicit AC; Eng lead sign-off |
| Prisma vs raw SQL policy unclear | Later EXCLUDE drift | ADR for Prisma+raw SQL this sprint |
| Over-scoped Operations Center | Distraction | Empty skeleton only |

---

## Dependencies

| Dependency | Type | Required |
|---|---|---|
| Sprint-01 complete (CI, health, monorepo) | Hard | Yes |
| Managed PostgreSQL, Redis, S3 for staging | Hard | Yes |
| Backup capability on managed Postgres | Hard | For restore AC |
| ADR: outbox durability + Prisma+raw SQL | Hard | Same sprint |
| Email/PSP | Soft | Parallel; not required for M1 |
| Sprint-03 | Downstream | Auth on this foundation |

---

## Deliverables

1. Prisma schema layout + initial platform migrations.
2. Repository/transaction/outbox/idempotency libraries.
3. Worker consumer baseline.
4. API contract envelopes + OpenAPI/CI stubs as applicable.
5. Staging environment with automated deploy.
6. Restore rehearsal evidence (date, operator, result).
7. Runbook skeletons (incident, migration, restore, deployment).
8. M1 sign-off record.

---

## Estimated Time

| Track | Estimate |
|---|---|
| Prisma + platform tables + repo patterns | 3 days |
| Outbox/worker/idempotency | 3 days |
| API envelopes + contract tests | 2 days |
| Staging + S3 wiring | 1–2 days |
| Restore rehearsal + runbooks | 1–2 days |
| **Sprint total** | **10 business days (2 weeks)** |

---

## Definition of Done

1. All acceptance criteria met, including **M1** and restore rehearsal.
2. Integration and contract tests pass in CI.
3. Coding standards and CI gates pass; reviews complete.
4. No critical/high open defects on platform durability paths.
5. Runbooks filed and linked from ops docs index.
6. Redis-loss / outbox durability test documented as passing.
7. Backlog refined for Sprint-03 auth tables and endpoints.
8. Deployed to **development and staging**, smoke-tested.
