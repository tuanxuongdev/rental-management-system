# Sprint-02 Implementation Review

**Review ID:** RPM-REVIEW-SPRINT-02  
**Review date:** 2026-07-22  
**Reviewer role:** Principal Software Architect / Senior Code Reviewer  
**Scope:** Implementation of [Sprint-02](../sprints/Sprint-02.md) only — no Sprint-03+ features evaluated  
**Normative baselines:** [00-overview](../00-overview.md) · [02-system-architecture](../02-system-architecture.md) · [03-database-design](../03-database-design.md) · [04-api-specification](../04-api-specification.md) · [08-folder-structure](../08-folder-structure.md) · [09-coding-standard](../09-coding-standard.md) · [10-development-roadmap](../10-development-roadmap.md) · [CODING_RULES.md](../../CODING_RULES.md) · [CLAUDE.md](../../CLAUDE.md) · [Sprint-01-Review.md](./Sprint-01-Review.md)

---

## Summary

Sprint-02 delivers the **data and operational foundation (M1)** for the Rental Property Management platform: Prisma platform migrations (`outbox_events`, `processed_messages`, `scheduled_jobs`, `idempotency_keys`), organization-aware repository guards, transactional outbox writer, worker consumer with dedupe, API idempotency on a sample endpoint, shared pagination/operations/idempotency contracts, PostgreSQL-backed `/ready`, integration tests in CI, staging deploy smoke workflow, and operations runbook skeletons.

During this review, **two critical durability defects** were found and corrected:

1. **Outbox consumer event loss** — the worker marked events `PUBLISHED` before inserting `processed_messages`, allowing unrecoverable stuck events after a crash between steps.
2. **Idempotency race** — concurrent requests with the same key could hit a unique-constraint violation and surface as an unhandled 500 instead of replaying the stored response.

After review fixes, **all local quality gates pass**: **29/29** unit tests, **4/4** integration tests, lint (zero warnings), typecheck, build, and Prettier format check.

The implementation **substantially meets Sprint-02 technical acceptance criteria**. Residual gaps are primarily **process and operational maturity** (formal M1 sign-off, completed restore rehearsal record, managed cloud staging, automated Redis-loss test T02-06) rather than missing core platform code paths.

**Note:** Angular best practices are **not applicable** — the web stack is React/Next.js per project documentation.

---

## Issues Found

### Critical (fixed during review)

| ID | Area | Issue | Severity |
|---|---|---|---|
| C1 | Worker / Outbox | `OutboxConsumerService` marked outbox rows `PUBLISHED` in a transaction **before** `processed_messages` insert. A crash between steps left events permanently unprocessable (poll only queries `PENDING`). Violates Sprint-02 validation rules 4 and acceptance criterion 3. | Critical |
| C2 | API / Idempotency | `IdempotencyService.resolveOrCreate` had no handling for `P2002` unique-constraint races. Concurrent identical requests could return **500** instead of replaying. | Critical |

### High (open — document / defer)

| ID | Area | Issue | Severity |
|---|---|---|---|
| H1 | Readiness | `DependencyCheckService.checkRedis()` always returns `skipped` even when `REDIS_URL` is configured. `/ready` does not prove Redis connectivity. | High (soft) |
| H2 | Testing | **T02-06** (flush Redis; outbox still drains) has no automated CI test. Architecturally satisfied by DB-backed outbox (ADR-0002), but sprint validation rule 8 is not mechanically proven. | High (soft) |
| H3 | Testing | **T02-11** restore rehearsal — runbook template exists but evidence record is unfilled; no automated restore pipeline in CI. | High (process) |
| H4 | Delivery | Staging deploy (`.github/workflows/deploy-staging.yml`) uses ephemeral Compose on the GitHub runner — not a persistent managed staging environment. | High (soft) |
| H5 | Process | **M1 formal sign-off** and stakeholder demo for data/ops foundation remain checklist items, not verifiable from code. | High (process) |
| H6 | Testing | No end-to-end test exercising worker `OutboxConsumerService.poll()` against a live outbox row; integration test simulates the atomic consume pattern directly. | High (soft) |

### Medium (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| M1 | ADR | [ADR-0003](../adr/0003-prisma-raw-sql-policy.md) remains **Proposed** despite Sprint-02 Prisma bootstrap completing. | Medium |
| M2 | API / Idempotency | `IdempotencyKeyStatus.PROCESSING` exists in schema but is unused; no in-flight lock for long-running handlers (acceptable for sample endpoint, watch in Sprint-03+). | Medium |
| M3 | API | `OutboxService.claimPendingBatch` (pre-review) duplicated the unsafe publish-before-dedupe pattern; removed during review. API-side batch claim API no longer exists — worker owns consumption. | Medium (fixed) |
| M4 | Documentation | Architecture docs still describe Vite SPA scaffold; web app is Next.js App Router (carryover from Sprint-01). | Medium |
| M5 | API | OpenAPI skeleton generation mentioned in sprint scope not yet produced (Zod contracts and HTTP tests cover envelopes). | Medium |
| M6 | Web / Testing | Status page extended with readiness DB check and idempotent echo demo, but no component/a11y tests for new UI paths. | Medium |
| M7 | CI | Migration **drift detection** baseline improved (`prisma:migrate:status` added) but no explicit `migrate diff` gate against shadow DB. | Medium |

### Low (open)

| ID | Area | Issue | Severity |
|---|---|---|---|
| L1 | Worker | `ProcessedMessageService` was redundant after consumer refactor; removed from worker module (file deleted). | Low (fixed) |
| L2 | S3 | `S3StorageClient` provides key-prefix convention only; no SDK upload/download yet (in scope as wiring-only). | Low |
| L3 | Platform | `scheduled_jobs` table exists; no scheduler runner yet (explicitly skeleton). | Low |
| L4 | Security | Idempotent echo and meta endpoints remain public/internal without auth (acceptable until Sprint-03). | Low |

---

## Architecture Compliance

| Criterion | Status | Notes |
|---|---|---|
| Prisma split schema + forward-only migrations | ✅ Pass | `prisma/schema/platform.prisma` + `20260722100000_init_platform_tables` |
| Organization-aware repository base | ✅ Pass | `TenantScopedRepositoryBase` + sample stub with unit test (T02-03) |
| Outbox as source of truth | ✅ Pass | ADR-0002 Accepted; append in same transaction as idempotent echo |
| Worker idempotent consumption | ✅ Pass (after C1 fix) | Atomic `processed_messages` + `PUBLISHED` in one transaction |
| API envelopes (errors, pagination, idempotency) | ✅ Pass | `@rpm/contracts` + meta endpoints |
| No business domain tables | ✅ Pass | No tenants/users/inventory |
| Forbidden org headers | ✅ Pass | Sprint-01 guard retained |
| CI integration tests on PostgreSQL | ✅ Pass | Dedicated `integration` job |
| Staging deploy automation | ⚠️ Partial | Compose smoke workflow; not managed cloud (H4) |
| Runbooks filed | ✅ Pass | incident, migration, restore, deployment + rehearsal template |
| Clean Architecture layering | ⚠️ Partial | Infrastructure modules appropriate; no domain/application layer yet (expected) |

---

## Business Requirements Compliance

| Sprint-02 requirement | Status | Evidence |
|---|---|---|
| Prisma migrate workflow in CI | ✅ | `prisma:migrate:deploy` + `prisma:migrate:status` in CI quality job |
| Org context required for tenant-owned queries | ✅ | `TenantScopedRepositoryBase`, T02-03 unit test |
| Outbox + worker + dedupe baseline | ✅ (post-fix) | Worker consumer, integration T02-04/05 |
| Idempotency on sample mutating route | ✅ | `POST /v1/meta/idempotent-echo`, T02-07/08 + race test |
| Shared API envelopes | ✅ | Contracts + HTTP T02-09 |
| `/ready` fails when PostgreSQL unreachable | ✅ | `DependencyCheckService.checkDatabase()`, HTTP T02-12 |
| Staging matches dev empty slice | ⚠️ Partial | `deploy-staging.yml` smoke (H4) |
| Restore rehearsal recorded | ❌ Process | Template only; operator sign-off pending (H3) |
| **M1 milestone** | ⚠️ Partial | Code + CI ready; formal sign-off pending (H5) |

---

## Database Implementation

| Item | Assessment |
|---|---|
| Platform tables | ✅ Correct per [03-database-design](../03-database-design.md): outbox, processed_messages, scheduled_jobs, idempotency_keys |
| Timestamps / indexes | ✅ `createdAt`, `updatedAt`, composite unique constraints on dedupe and idempotency |
| Enums | ✅ `OutboxEventStatus`, `ScheduledJobStatus`, `IdempotencyKeyStatus` |
| Migration immutability | ✅ Single forward migration; lock file present |
| Money / domain prep | ✅ Deferred appropriately |
| Transaction pattern | ✅ Outbox append + idempotency record share `TransactionService.run` |

---

## API Implementation

| Endpoint | Status | Notes |
|---|---|---|
| `GET /ready` | ✅ | Async; checks configuration + PostgreSQL |
| `GET /v1/meta/pagination-example` | ✅ | Empty cursor envelope |
| `GET /v1/meta/operations` | ✅ | Empty operations skeleton |
| `POST /v1/meta/idempotent-echo` | ✅ | Requires `Idempotency-Key`; sets `Idempotency-Replayed` header |
| RFC 9457 errors | ✅ | `ProblemDetailsFilter`; idempotency/org errors typed |
| Validation | ✅ | Zod schemas in contracts; 422 on missing idempotency key |

---

## UI Implementation

| Surface | Status | Notes |
|---|---|---|
| `/status` page | ✅ | Shows readiness (incl. DB), version, idempotent echo demo |
| Operations Center UI | ✅ N/A | Correctly deferred (API skeleton only) |
| Accessibility | ⚠️ Partial | `aria-live` on status panel; no automated a11y suite (M6) |

---

## Clean Architecture, SOLID, DRY

| Principle | Assessment |
|---|---|
| **Single Responsibility** | ✅ Services split: outbox, idempotency, transactions, dependency checks |
| **Open/Closed** | ✅ Repository base extensible for future tenant models |
| **Liskov** | ✅ N/A at current depth |
| **Interface Segregation** | ✅ Contracts package exposes focused schemas |
| **Dependency Inversion** | ✅ Nest modules inject Prisma/services; explicit `@Inject` on controllers and interceptors |
| **DRY** | ⚠️ Worker and integration test both encode atomic consume logic; acceptable until shared `@rpm/platform` extraction |
| **KISS** | ✅ No premature abstractions beyond sprint scope |

---

## Security, Authentication, Authorization

| Area | Status | Notes |
|---|---|---|
| Authentication | ✅ N/A | Sprint-03 scope |
| Authorization | ✅ N/A | Meta endpoints intentionally public for M1 slice |
| Org header rejection | ✅ | Sprint-01 guard retained |
| Idempotency scope | ✅ | Platform `actorScope` until auth exists |
| Secrets in logs | ✅ | No credentials in health/meta responses |
| S3 key prefix | ✅ | `org/{organizationId}/...` documented in client |
| Input validation | ✅ | Zod on echo body and idempotency header |

---

## Error Handling & Validation

| Area | Status |
|---|---|
| Problem Details envelope | ✅ |
| Idempotency key missing | ✅ 422 `IDEMPOTENCY_KEY_REQUIRED` |
| Idempotency body mismatch | ✅ 409 `IDEMPOTENCY_KEY_REUSED` |
| Missing org context (repos) | ✅ `MissingOrganizationContextError` |
| Outbox consumer failures | ✅ Logged; event remains `PENDING` for retry (post C1 fix) |
| Prisma unique violations (idempotency) | ✅ Handled as replay (post C2 fix) |

---

## Performance

| Area | Assessment |
|---|---|
| Outbox poll interval | ✅ 2s default; batch size 25 — appropriate for skeleton |
| Integration test isolation | ✅ `resetPlatformTables` between cases |
| N+1 / query efficiency | ✅ N/A at current scale |
| Web bundle | ✅ Status page ~20 kB route JS — acceptable |

---

## Accessibility

Partial WCAG 2.2 AA on status page (live regions, semantic structure). No axe/Playwright a11y gate. Acceptable for dev-only status surface; track for Sprint-03+ staff UI.

---

## Folder Structure & Naming Conventions

- ✅ Platform code under `apps/api/src/infrastructure/{persistence,outbox,idempotency,platform,storage}`
- ✅ Worker outbox under `apps/worker/src/outbox/`
- ✅ Contracts in `packages/contracts/src/{pagination,idempotency,operations}.ts`
- ✅ Integration helpers in `packages/testing`
- ✅ Runbooks in `docs/runbooks/`
- ⚠️ Next.js vs documented Vite layout (carryover M4)

---

## Testing

| Suite | Tests | Status |
|---|---|---|
| `@rpm/contracts` (Sprint-01 + 02) | 9 | ✅ |
| API configuration | 5 | ✅ |
| HealthService | 3 | ✅ |
| Tenant-scoped repository | 2 | ✅ T02-03 |
| App HTTP (Sprint-01) | 6 | ✅ |
| App HTTP (Sprint-02) | 4 | ✅ T02-09, T02-12, idempotency 422, operations |
| Platform integration (PostgreSQL) | 4 | ✅ T02-01, T02-04/05, T02-07/08, race |
| **Total automated** | **33** | ✅ All passing |

**Gaps:** T02-06 (Redis flush), T02-11 (restore rehearsal automation), worker E2E poll test (H6), web UI tests (M6).

---

## Technical Debt

| Item | Notes |
|---|---|
| Redis readiness stub (H1) | Implement ping when `REDIS_URL` set |
| `PROCESSING` idempotency status unused (M2) | Needed for long handlers in Sprint-03+ |
| ADR-0003 still Proposed (M1) | Finalize after first raw-SQL fragment |
| Doc drift Next vs Vite (M4) | Reconcile architecture docs |
| Shared outbox consume helper | Worker + integration test duplicate atomic pattern |
| OpenAPI artifact (M5) | Generate from Zod when external clients arrive |

---

## Changes Made

The following safe corrections were applied during this review **without implementing Sprint-03 features**:

1. **`OutboxConsumerService`** — Refactored to process each event in a **single transaction**: insert `processed_messages`, then mark `PUBLISHED`. Handles unique-violation retries by reconciling already-processed messages. Removed unsafe publish-first ordering (C1).
2. **`IdempotencyService.resolveOrCreate`** — Catches `P2002` unique violations and returns replayed response or conflict instead of 500 (C2). Added `prisma-errors.ts` helper.
3. **`OutboxService.claimPendingBatch`** — Removed API method that replicated the unsafe publish-before-dedupe pattern (M3).
4. **`ProcessedMessageService` (worker)** — Deleted unused service after consumer refactor (L1).
5. **`RequestLoggingInterceptor`** — Added explicit `@Inject(StructuredLogger)` (Sprint-01 carryover M2).
6. **`app.http.spec.ts`** — Added Sprint-02 HTTP tests: pagination envelope (T02-09), operations skeleton, idempotency 422, readiness DB failure (T02-12).
7. **`platform.integration.spec.ts`** — Rewrote T02-04/05 to use atomic consume pattern; added concurrent idempotency race test.
8. **`.github/workflows/deploy-staging.yml`** — Fixed idempotent echo smoke to assert response header `Idempotency-Replayed: true` on replay (was incorrectly sending the header on the request).
9. **`.github/workflows/ci.yml`** — Added `pnpm prisma:migrate:status` after migrate deploy (M7 partial).
10. **`README.md`** — Updated for Sprint-02 endpoints, runbook index, integration/migrate scripts, corrected stack description.
11. **Prettier** — Formatted Sprint-02 files to pass `pnpm format:check`.

**Verification after fixes:**

```bash
pnpm lint && pnpm typecheck && pnpm format:check && pnpm unit && pnpm integration && CI=true pnpm build
```

All gates pass.

---

## Remaining Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Restore rehearsal not executed (H3) | M1 recoverability claim unproven | Complete [restore-rehearsal-record.md](../runbooks/restore-rehearsal-record.md) in non-prod |
| M1 sign-off open (H5) | Sprint DoD item 9 incomplete | Eng lead sign-off after staging smoke + rehearsal |
| Redis readiness stub (H1) | False confidence when Redis required | Add `PING` check; fail `/ready` when `REDIS_URL` set and unreachable |
| No T02-06 automation (H2) | Redis-loss scenario not CI-proven | Add integration test: stop Redis, verify outbox still processes |
| Compose-only staging (H4) | Parity gap vs production topology | Provision managed Postgres/Redis/S3 when accounts ready |
| Worker E2E gap (H6) | Regression in poll loop less likely caught | Add worker integration test invoking `OutboxConsumerService.poll()` |
| Idempotency without PROCESSING lock (M2) | Rare duplicate side effects on very slow handlers | Adopt PROCESSING + TTL before Sprint-03 mutating routes |

---

## Overall Score

| Category | Weight | Score |
|---|---|---|
| Architecture & folder compliance | 15% | 86 |
| Business / sprint requirements | 20% | 82 |
| Database implementation | 10% | 90 |
| API & contracts | 15% | 88 |
| UI & vertical slice | 5% | 80 |
| Security & validation | 10% | 85 |
| Testing & CI/CD | 15% | 84 |
| Code quality (SOLID/DRY/KISS) | 10% | 87 |

### **Overall: 86 / 100**

*Score reflects strong technical delivery with deductions for process gaps (M1 sign-off, restore rehearsal), Redis readiness stub, and missing T02-06 automation. Pre-review score would have been ~72/100 due to C1 and C2.*

---

## Recommendation

### **Approve with conditions**

Sprint-02 implementation is **fit for purpose** as the data and operational foundation for Sprint-03 identity work. Critical durability defects (C1, C2) are resolved; quality gates pass; scope boundaries are respected (no Sprint-03 auth/domain features).

**Conditions for sprint closure (non-code):**

1. Complete a non-production **restore rehearsal** and file [restore-rehearsal-record.md](../runbooks/restore-rehearsal-record.md).
2. Obtain **M1 sign-off** from engineering lead after dev + staging smoke evidence.
3. Track Redis readiness ping and T02-06 automated test as immediate Sprint-03 parallel tasks if not completed before sign-off.

**Conditions for production confidence (before GA, not blocking Sprint-03 start):**

1. Provision managed staging (Postgres, Redis, S3) replacing Compose-only smoke.
2. Finalize ADR-0003 status after first raw-SQL migration fragment.
3. Add worker E2E outbox poll test and web a11y checks as UI grows.

---

*Review generated 2026-07-22. Re-run verification after substantive changes: `pnpm unit && pnpm integration && pnpm lint && pnpm typecheck && pnpm build && pnpm format:check`.*
