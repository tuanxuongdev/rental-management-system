# Sprint-02 Implementation Summary

**Sprint ID:** Sprint-02 — Data and Operational Foundation  
**Implementation date:** 2026-07-22  
**Scope:** Sprint-02 only (M1 data/ops baseline)  
**Baseline:** [Sprint-02.md](../sprints/Sprint-02.md) · [Sprint-01-Review.md](./Sprint-01-Review.md)

---

## Features Implemented

| # | Feature | Status |
|---|---|---|
| 1 | Prisma migrate workflow with platform tables | Done |
| 2 | Organization-context + tenant-scoped repository base | Done |
| 3 | Outbox writer (API) + worker consumer with `processed_messages` dedupe | Done |
| 4 | Idempotency key store on sample `POST /v1/meta/idempotent-echo` | Done |
| 5 | Shared API envelopes (Problem Details, cursor pagination, operations skeleton) | Done |
| 6 | `/ready` PostgreSQL dependency check | Done |
| 7 | S3 key-prefix convention + config wiring (no upload UI) | Done |
| 8 | Integration tests against real PostgreSQL | Done |
| 9 | CI: migrate deploy + integration job | Done |
| 10 | Staging deploy workflow (Compose parity smoke) | Done |
| 11 | Runbook skeletons (incident, migration, restore, deployment) | Done |
| 12 | Web status page: readiness + idempotent echo demo | Done |

---

## Files Created

### Prisma / database

- `prisma/schema/platform.prisma`
- `prisma/schema/migrations/20260722100000_init_platform_tables/migration.sql`
- `prisma/schema/migrations/migration_lock.toml`

### Contracts (`@rpm/contracts`)

- `packages/contracts/src/pagination.ts`
- `packages/contracts/src/idempotency.ts`
- `packages/contracts/src/operations.ts`
- `packages/contracts/src/platform-utils.ts` (server-only via `@rpm/contracts/server`)
- `packages/contracts/src/server.ts`
- `packages/contracts/src/sprint-02.contracts.spec.ts`

### API (`apps/api`)

- `src/infrastructure/persistence/organization-context.ts`
- `src/infrastructure/persistence/organization-context.error.ts`
- `src/infrastructure/persistence/tenant-scoped-repository.base.ts`
- `src/infrastructure/persistence/sample-tenant-owned.repository.ts`
- `src/infrastructure/persistence/sample-tenant-owned.repository.spec.ts`
- `src/infrastructure/persistence/transaction.service.ts`
- `src/infrastructure/outbox/outbox.service.ts`
- `src/infrastructure/idempotency/idempotency.service.ts`
- `src/infrastructure/platform/dependency-check.service.ts`
- `src/infrastructure/platform/platform-infrastructure.module.ts`
- `src/infrastructure/platform/platform.integration.spec.ts`
- `src/infrastructure/storage/s3-storage.client.ts`
- `src/modules/meta/meta.service.ts`

### Worker (`apps/worker`)

- `src/infrastructure/prisma/prisma.module.ts`
- `src/outbox/processed-message.service.ts`
- `src/outbox/outbox-consumer.service.ts`

### Testing / CI

- `packages/testing/src/integration-database.ts`
- `packages/testing/src/test-id.ts`
- `vitest.integration.config.ts`
- `.github/workflows/deploy-staging.yml`

### Runbooks

- `docs/runbooks/incident.md`
- `docs/runbooks/migration.md`
- `docs/runbooks/restore.md`
- `docs/runbooks/deployment.md`
- `docs/runbooks/restore-rehearsal-record.md`

---

## Files Modified

| Area | Files |
|---|---|
| Contracts index | `packages/contracts/src/index.ts`, `packages/contracts/package.json` |
| API config / health | `apps/api/src/bootstrap/configuration.ts`, `configuration.spec.ts`, `health.service.ts`, `health.service.spec.ts`, `health.module.ts`, `readiness.controller.ts` |
| Meta API | `apps/api/src/modules/meta/meta.controller.ts`, `meta.module.ts` |
| Errors | `apps/api/src/common/errors/problem-details.filter.ts` |
| HTTP tests | `apps/api/src/app.http.spec.ts` |
| Worker | `apps/worker/src/app.module.ts`, `bootstrap/configuration.ts` |
| Web | `apps/web/src/lib/api-client.ts`, `features/platform/hooks/use-platform-status.ts`, `features/platform/components/platform-status-panel.tsx` |
| Tooling | `package.json`, `vitest.config.ts`, `.env.example`, `prisma/README.md` |
| Docker / CI | `infrastructure/docker/docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/deploy-dev.yml` |
| ADR | `docs/adr/0002-transactional-outbox.md` (status → Accepted) |
| Testing package | `packages/testing/package.json`, `packages/testing/src/index.ts` |
| API deps | `apps/api/package.json` |

---

## Database Changes

### New tables (migration `20260722100000_init_platform_tables`)

| Table | Purpose |
|---|---|
| `outbox_events` | Transactional outbox (source of truth for async work) |
| `processed_messages` | Consumer idempotency / dedupe |
| `scheduled_jobs` | Durable job scheduling metadata (skeleton) |
| `idempotency_keys` | API idempotency records (platform-scoped sample) |

### Enums

- `OutboxEventStatus` (`PENDING`, `PUBLISHED`, `FAILED`)
- `ScheduledJobStatus` (`ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`)
- `IdempotencyKeyStatus` (`PROCESSING`, `COMPLETED`, `FAILED`)

### Notes

- No business/tenant domain tables (deferred to Sprint-03+).
- Local Docker Postgres exposed on **host port 5433** to avoid conflicts.
- Migrations live under `prisma/schema/migrations/` (alongside split schema files).

---

## API Changes

| Method | Path | Change |
|---|---|---|
| `GET` | `/health` | Unchanged (liveness) |
| `GET` | `/ready` | Now async; checks `configuration`, `database`, `redis` (skipped if unset) |
| `GET` | `/v1/meta/version` | Unchanged |
| `GET` | `/v1/meta/ping` | Unchanged |
| `GET` | `/v1/meta/pagination-example` | **New** — empty cursor collection envelope |
| `GET` | `/v1/meta/operations` | **New** — empty operations skeleton |
| `POST` | `/v1/meta/idempotent-echo` | **New** — requires `Idempotency-Key`; writes outbox in same transaction |

### Contract updates

- RFC 9457 Problem Details now includes `requestId` (alongside `correlationId`).
- Cursor pagination envelope: `{ data, page: { nextCursor, previousCursor, limit }, meta }`.
- Idempotency: replay returns `Idempotency-Replayed: true`; body mismatch → `409 IDEMPOTENCY_KEY_REUSED`.

---

## Verification Results

| Gate | Result |
|---|---|
| `pnpm lint` | Pass |
| `pnpm typecheck` | Pass |
| `pnpm unit` | **25/25** pass |
| `pnpm integration` | **3/3** pass (PostgreSQL on `localhost:5433`) |
| `pnpm build` | Pass (API, worker, web; use `CI=true` if local `next build` hangs on Windows) |
| `pnpm format:check` | Not re-run after final edits (run before merge) |

### Integration test coverage (Sprint-02)

| ID | Case | Covered |
|---|---|---|
| T02-01 | Platform tables exist after migration | Yes |
| T02-03 | Repository without org context fails | Yes (unit) |
| T02-04/05 | Outbox processed exactly once | Yes |
| T02-07/08 | Idempotency replay / conflict | Yes |

---

## Remaining Tasks

| Task | Owner | Notes |
|---|---|---|
| Formal restore rehearsal sign-off | Platform / Eng lead | Use [restore-rehearsal-record.md](../runbooks/restore-rehearsal-record.md) |
| Managed staging Postgres/Redis/S3 (non-Compose) | Platform | Workflows use Compose smoke until cloud env ready |
| Redis readiness ping | Backend | Currently `skipped` when `REDIS_URL` unset |
| OpenAPI skeleton generation | Backend | Contract Zod schemas ready; OpenAPI artifact not generated |
| M1 stakeholder sign-off | Eng lead | Process artifact |
| `btree_gist` extension prep | DBA | Documented intent; not required until leasing sprint |

---

## Known Limitations

1. **Outbox relay** — Worker polls PostgreSQL directly; Redis queue relay is deferred (outbox remains SoT per ADR-0002).
2. **S3 client** — Key prefix convention and config only; no SDK upload/download yet.
3. **Auth / org tables** — Explicitly out of scope; idempotency uses platform `actorScope` until Sprint-03.
4. **Staging deploy** — GitHub Actions Compose smoke, not a persistent cloud staging URL.
5. **Scheduled jobs** — Schema only; no scheduler runner yet.
6. **Redis loss test T02-06** — Architecturally satisfied (DB-backed outbox); no automated Redis flush test in CI yet.

---

## Backward Compatibility (Sprint-01)

- All Sprint-01 endpoints retained and tested.
- Correlation ID behavior unchanged.
- Organization header rejection guard unchanged.
- `/ready` response shape extended with `database` and `redis` checks (additive).

---

*Sprint-02 implementation complete for code deliverables. Run `pnpm prisma:migrate:deploy` before starting API/worker locally.*
