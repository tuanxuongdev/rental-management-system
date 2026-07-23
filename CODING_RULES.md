# Coding Rules (Mandatory)

**Status:** Binding for all implementation  
**Audience:** Engineers, reviewers, and coding agents  
**Authority:** Derived from normative docs under [`docs/`](./docs), especially [`docs/09-coding-standard.md`](./docs/09-coding-standard.md), [`docs/08-folder-structure.md`](./docs/08-folder-structure.md), [`docs/02-system-architecture.md`](./docs/02-system-architecture.md), [`docs/03-database-design.md`](./docs/03-database-design.md), [`docs/04-api-specification.md`](./docs/04-api-specification.md), [`docs/05-authentication.md`](./docs/05-authentication.md), [`docs/06-permission-system.md`](./docs/06-permission-system.md), [`docs/07-ui-design.md`](./docs/07-ui-design.md), [`docs/design-system.md`](./docs/design-system.md), [`docs/git-workflow.md`](./docs/git-workflow.md), and [`docs/commit-convention.md`](./docs/commit-convention.md).

Rules marked **MUST** / **MUST NOT** are mandatory. Exceptions require PR rationale, owner approval, and—when architectural—an ADR under `docs/adr/`.

Related agent entry points: [`AGENTS.md`](./AGENTS.md), [`CLAUDE.md`](./CLAUDE.md). Contribution process: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## 1. Document precedence

When sources conflict, resolve in this order:

1. Accepted ADRs in `docs/adr/`
2. Domain/security docs (`03`, `04`, `05`, `06`, architecture/review findings)
3. This file + `docs/09-coding-standard.md`
4. Folder structure (`docs/08-folder-structure.md`) adapted to the **implemented** stack
5. UI screen specs under `docs/ui/`
6. Sprint plans under `docs/sprints/`

**Do not** redesign architecture, database design, API contracts, permission model, or UI specifications in code. Change docs (and ADR when required) first.

**Stack note:** Early architecture docs describe a Vite React SPA. The foundation uses **Next.js App Router** (`apps/web`), **TanStack Query**, and **Zustand**. Frontend rules below bind that stack to the same isolation, auth, and UX constraints as the docs. Do not reintroduce Vite without an ADR.

---

## 2. Canonical vocabulary

| Term | Meaning | Forbidden |
|---|---|---|
| **Organization** | SaaS customer / isolation boundary | Calling it “tenant” in customer UI |
| **`tenant_id` / `tenantId`** | Internal DB/impl representation of Organization | Using caller-supplied IDs as auth proof |
| **Resident** | Person who lives or will live at a Property | Calling renters “tenants”; no `/tenants` API |
| **Lease** | Dated occupancy + financial agreement | `/contracts` alias |
| **Unit** | Independently managed occupancy space | **Room** entity, `ROOM` table, `/rooms`, `room` as Unit synonym |
| **Bed** | Optional assignable place in a shared Unit | Required for every shared Unit |
| **Property Owner** | Beneficial owner (`parties` + owner profile) | Treating as User or Organization Owner by default |
| Hierarchy | `Property > Unit > optional Bed` | Inserting a Room layer |

Module names: `tenancy` = SaaS Organization; `parties` = people/CRM orgs. **Never** a generic `organizations` module.

---

## 3. Architecture rules

**MUST**

- Ship a **modular monolith** (`apps/api` + `apps/worker`) before microservices; extract only with evidence + ADR.
- Keep PostgreSQL as source of truth for financial, lease, occupancy, and permission data. Redis is never authoritative for those.
- Commit business data and **outbox** events in the **same** PostgreSQL transaction; workers consume at-least-once with idempotency.
- Cross-module access via exported application APIs or durable events—not another module’s private repositories/tables.
- Derive Organization context from authenticated organization-scoped JWT/session membership (or explicit audited platform-support workflow)—never from arbitrary request data.
- Include non-null Organization/`tenantId` on every tenant-owned row; scope FKs, uniques, caches, S3 keys, rate limits, and audit where applicable.
- Keep DB transactions short; **MUST NOT** hold transactions open across remote/network calls.

**MUST NOT**

- Use `X-Tenant-ID`, `X-Organization-ID`, or any caller-selected tenant header (API responds `400 ORGANIZATION_HEADER_FORBIDDEN`).
- Let platform roles silently bypass repository Organization scoping.
- Store card PAN; use payment-provider tokens only.
- Import one app’s source from another app (`apps/web` ↛ `apps/api`, worker ↛ api implementation).
- Put business logic in controllers, route pages, or UI-only permission checks as the authority.

---

## 4. Folder structure

### 4.1 Monorepo

```text
apps/web          Next.js App Router UI
apps/api          NestJS HTTP API
apps/worker       NestJS background workers
packages/ui       App-agnostic primitives + tokens
packages/contracts  OpenAPI/events/common schemas (no Nest/Prisma/React runtime)
packages/config   Shared tooling config
packages/testing  Test-only utilities (never a production dependency)
prisma/           Schema, migrations, raw-sql, seeds
docs/             Normative product/engineering docs + ADRs
infrastructure/   Docker, deploy, monitoring
tooling/          Scripts/generators (not runtime)
.github/          CI, templates, CODEOWNERS
```

### 4.2 `apps/web` (Next.js)

```text
apps/web/src/
  app/                 App Router: layouts, route groups, pages, loading/error
  features/<domain>/   Feature modules (api, components, hooks, schemas, types, utils, index.ts)
  components/          Cross-feature app shells only
  lib/                 Framework adapters, typed API client helpers
  state/               Minimal client UI/session state (Zustand)
  styles/              Global styles / Tailwind entry
  types/               Web-only types (not transport contracts)
```

Route groups separate shells: public/auth, staff `(app)`, resident portal, platform—aligned with `docs/navigation.md`.

Feature shape (adapt Vite doc to Next):

```text
features/leasing/
  api/           *.queries.ts, *.mutations.ts
  components/
  hooks/
  schemas/       form/view Zod (UI-facing)
  types/
  utils/
  index.ts       public surface only
```

**Accepted adapter (Sprint-06):** typed HTTP clients may live in `apps/web/src/lib/*-api.ts` and be called from feature hooks. Prefer co-locating new domain clients under `features/<domain>/api/` when adding greenfield modules; do not invent a second transport contract outside `@rpm/contracts`.

Thin `app/**/page.tsx` files compose features; business logic stays in features/domain.
### 4.3 `apps/api`

```text
modules/<domain>/
  application/     commands, queries, dto, services (transaction boundary)
  domain/          entities, value-objects, events, policies, repository ports
  infrastructure/  Prisma repos, integrations
  presentation/    controllers, presenters
  <domain>.module.ts
  index.ts
```

Dependency direction:

```text
presentation → application → domain
infrastructure → application/domain ports
domain → no NestJS, Prisma, Redis, S3, or HTTP
```

### 4.4 `apps/worker`

Mirror domain module names under `handlers/`. Jobs are idempotent. Payloads carry stable IDs, tenant/org, schema version, correlation/trace IDs—not large sensitive snapshots.

### 4.5 Prisma schemas

Split by domain: `base`, `identity`, `tenancy`, `inventory`, `parties`, `leasing`, `billing`, `payments`, `utilities`, `maintenance`, `documents`, `communications`, `reporting`, `audit`, `imports`. Prisma-unsupported DDL lives in reviewed `prisma/raw-sql/` and is copied into ordered migrations.

### 4.6 Dependency bans

| Forbidden | Reason |
|---|---|
| `packages/*` → `apps/*` | Package purity |
| App → another app | Deployable isolation |
| `contracts` → Nest/Prisma/React entities | Transport-only |
| Production → `packages/testing` | Test leakage |
| Deep imports bypassing `exports` | Boundary enforcement |
| Domain → Prisma/Nest types | Hexagonal integrity |

---

## 5. Naming conventions

| Kind | Convention |
|---|---|
| Directories | `kebab-case` |
| TS files | `kebab-case.ts` (+ Nest suffixes) |
| React components | `PascalCase.tsx`, one primary component per file |
| Hooks | `use-feature-name.ts` |
| Nest files | `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.guard.ts`, `*.repository.ts` |
| Tests | `*.spec.ts(x)`, `*.e2e-spec.ts` |
| Types/classes | `PascalCase` |
| Functions/props | `camelCase` |
| Constants/env | `UPPER_SNAKE_CASE` |
| Booleans | `is` / `has` / `can` / `should` / `was` prefix |
| IDs | Explicit (`tenantId`, `leaseId`); avoid bare `id` outside entity scope |
| Commands / events | Imperative / past tense (`CreateLeaseCommand`, `LeaseActivated`) |
| Prisma models | Singular `PascalCase`; fields `camelCase`; DB `snake_case` via `@map` / `@@map` |
| API paths | Plural `kebab-case` under `/api/v1` (e.g. `/api/v1/lease-charges`) |
| JSON / query | `camelCase` |
| Permissions | `<domain>.<resource>.<action>`; avoid vague `manage_all` |

---

## 6. TypeScript rules

**MUST** use strict settings (`strict`, `noImplicitOverride`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, etc.).

**MUST NOT** use `any` (narrow documented third-party boundary only), non-null assertions to silence uncertainty, or casual `as` casts without validation.

**MUST**

- Prefer `unknown` + narrowing; discriminated unions; exhaustive switches.
- Use approved arbitrary-precision decimal + ISO 4217 for money—**never** JS `number`/float for currency.
- Transport money as decimal strings; round only via named tested policies.
- Store/exchange timestamps in UTC; keep property business timezone separate for billing/due dates.
- Await/return async work or detach only through approved background mechanisms with error reporting.

---

## 7. React rules

**MUST**

- Function components and hooks only.
- Keep render pure; derive values instead of mirroring them in state.
- Put reusable domain UI in features; primitives in `packages/ui`.
- Use entity identity for list keys (no index keys for mutable/reorderable lists).
- Design loading, empty, error, forbidden, and partial states deliberately.
- Treat client permission checks as **presentation only**; API is authoritative.
- Target WCAG 2.2 AA; semantic HTML before ARIA; associate labels and errors.
- Avoid premature `memo` / `useMemo` / `useCallback`.

**MUST NOT**

- Store access/refresh tokens in `localStorage`, `sessionStorage`, IndexedDB, service-worker caches, persisted client stores, or readable cookies.
- Render unsanitized HTML without approved sanitizer + security review.
- Put secrets or sensitive PII in URLs, analytics, browser logs, or client error reports.
- Optimistically mutate high-risk financial actions unless the server protocol supports safe rollback.

---

## 8. Next.js rules

**MUST**

- Use **App Router** under `apps/web/src/app` with route groups for shells (public, staff, resident, platform).
- Keep `page.tsx` / `layout.tsx` thin: composition, metadata, and wiring—not domain invariants.
- Default to Server Components; add `'use client'` only for interactivity, browser APIs, or client-only libraries (Query, Zustand, RHF).
- Fetch authoritative org-scoped data through the typed API client + TanStack Query on the client, or through server-side calls that still enforce cookie/session auth—never trust client-supplied Organization IDs.
- Colocate `loading.tsx` / `error.tsx` where UX requires distinct states.
- Use Next.js Route Handlers only as BFF/adapters when justified; do not reimplement Nest domain logic in Next.
- Prefer route-level code splitting; monitor bundle regressions in CI.

**MUST NOT**

- Put secrets in `NEXT_PUBLIC_*` except intentionally public values.
- Use middleware to “prove” Organization isolation in place of API authz.
- Fetch another Organization’s data into RSC payload and filter in the UI.
- Bypass feature module boundaries by dumping domain logic into `app/`.

Organization switch **MUST**: block UI → cancel in-flight work → token/session exchange → purge prior-org Query/Zustand drafts/prefetches → reset property scope → then render.

---

## 9. NestJS rules

**MUST** apply request processing in order:

1. Authentication  
2. Trusted Organization context establishment  
3. Authorization  
4. DTO/body validation  
5. Controller → use case  

Resource IDs or bodies **MUST NOT** establish Organization context.

**MUST**

- Controllers: HTTP, DTO validation, status codes, response mapping—**no direct Prisma**.
- Application services: orchestration + transaction boundaries.
- Domain: invariants without framework dependencies.
- Repositories/adapters: isolate Prisma, Redis, S3, queues, email, payments.
- Constructor injection; inject ports/tokens at boundaries.
- Return documented DTOs—not raw Prisma models.
- Validate DTOs with allowlist strategy; reject/strip unknown properties per API policy.
- Bound pagination; no unbounded list endpoints.
- Use outbox for commit + async consistency; idempotent retries/webhooks; verify payment signatures + replay protection.

**MUST NOT**

- Introduce circular modules / `forwardRef` as a design habit.
- Store tenant/actor state in process-global variables.
- Use service-locator patterns or mutable global singletons for request context.

---

## 10. Prisma rules

**MUST**

- Every Organization-owned repository method take non-optional `OrganizationContext` (trusted `organizationId`). Platform-only methods take distinct `PlatformContext`.
- Include trusted Organization filter on **every** org-owned query/mutation (including relation, aggregate, update, delete, exists).
- Prefer org-scoped compound uniqueness / scoped `findFirst` over `findUnique({ id })` unless constraints prove safety.
- Define both sides of relations; FKs unless documented exception; composite indexes often starting with `tenantId`.
- Use explicit status fields and reviewed transitions—not critical state inferred only from nullable timestamps.
- Include `createdAt` / `updatedAt`; soft delete is not default.
- Keep Prisma types out of public API/domain contracts.
- Use transactions + locking/optimistic concurrency for financial writes, lease activation, Unit/Bed allocation, and other contested ops.
- Enforce occupancy with documented GiST `EXCLUDE` / capacity rules—not a manually editable “occupied” flag as source of truth.

**MUST NOT**

- Use `$queryRaw` / `$executeRaw` / `*Unsafe` in application code. Only approved migration helpers for unsupported DDL; `*RawUnsafe` remains forbidden.
- Expose optional `tenantId`/`organizationId` filters that callers can omit.

---

## 11. API implementation rules

**MUST**

- Public API under `/api/v1` with OpenAPI 3.1 kept in sync.
- JSON `application/json`; errors as RFC 9457 `application/problem+json` via central mapper.
- Problem body includes safe `type`, `title`, `status`, optional `detail`, stable `code`, `correlationId`/`requestId`, optional field errors.
- Ordinary JWT carries exactly one `org_id` (+ membership); path `{organizationId}` must match token or respond **`404`** (except documented token-exchange flows).
- Out-of-org resource access → normally **`404`**; in-org insufficient permission → **`403`**.
- Cursor pagination: default limit 25, max 100.
- Money: `{ amount: decimal-string, currency: ISO-4217 }`; dates `YYYY-MM-DD`; instants RFC 3339 UTC; enums uppercase where specified.
- Idempotency-Key on mutating financial / externally retried ops; If-Match where versioned.
- Webhooks: HMAC-signed, versioned, replay-safe, durable raw event stored.

**MUST NOT**

- Return stack traces, SQL, secrets, Organization data leaks, or raw provider payloads.
- Use ad hoc error envelopes.
- Let `organizationId` in body/query select write partition or prove access.
- Invent `/rooms` or `/tenants` resources.

Breaking changes require new major version or documented deprecation (≥12 months, ≥6 after GA replacement) except security/legal emergencies.

---

## 12. Database migration rules

**MUST**

- Represent every schema change as a reviewed migration committed with the code.
- Treat applied migrations as **immutable**; fix forward with new migrations.
- Use expand → migrate → contract for breaking/large changes; backfill in bounded resumable batches.
- Document prechecks, duration, monitoring, abort, and recovery for production migrations.
- Place Prisma-unsupported DDL (GiST exclusions, partial indexes, RLS, etc.) in ordered migrations + real PostgreSQL tests.
- Keep seeds idempotent; never seed production secrets.

**MUST NOT**

- Edit already-applied migration history.
- Run risky long migrations on application startup.
- Assume destructive down migrations are safe; prefer forward-fix / compatible rollback.

---

## 13. State management rules

Approved libraries for this repo:

| Concern | Library | Rules |
|---|---|---|
| Server state | **TanStack Query** | Caching, retries, invalidation, mutations |
| Minimal client UI/session state | **Zustand** | Actor, org selection, narrowly shared UI only |
| Forms | React Hook Form + Zod | Align with API contracts; UI messages local |

**MUST**

- Put fetched domain collections in Query—**not** duplicated into Zustand.
- Include trusted `organizationId` (and auth/property/filter identity as needed) in every org-scoped query key.
- On Organization switch: cancel in-flight requests; purge previous-org queries, mutations, optimistic state, persisted caches, prefetches, and local drafts before rendering new org.
- Call APIs only through the approved typed client and feature `*.queries.ts` / `*.mutations.ts` modules.

**MUST NOT**

- Persist tokens in Zustand (or any readable storage).
- Use global stores as a second source of truth for invoices, leases, balances, or permissions.

---

## 14. Styling rules

**MUST**

- Use Tailwind with **semantic tokens** mapped from CSS variables (`background`, `foreground`, `primary`, `destructive`, `success`, `warning`, `info`, `sidebar-*`, `status-*`, etc.) per [`docs/design-system.md`](./docs/design-system.md).
- Keep application-agnostic primitives in `packages/ui` with no routes, domain terms, API clients, or tenant state.
- Communicate status with text/icon + color—never color alone.
- Externalize user-visible strings (EN + VI at GA); never infer currency from locale alone.
- Use tabular numerals for money, counts, dates, and meter readings.
- Respect reduced-motion preferences.

**MUST NOT**

- Use raw palette utilities (e.g. `red-600`) in product components (viz/prototypes only).
- Fork markup per theme; use `dark` / density attributes and tokens.

---

## 15. Testing rules

Pyramid (broad → narrow): unit → component/service → integration (real PostgreSQL for every Prisma repo) → contract (API/problem+json/OpenAPI/events) → e2e (critical journeys only).

**Organization isolation is a merge gate.** Every org-owned repository and endpoint **MUST** prove:

1. Authorized same-Organization success  
2. Unauthorized role same-Organization denial  
3. Wrong-Organization ID non-disclosure  
4. Missing/malformed context failure  
5. Audit behavior for sensitive actions  

**MUST**

- Keep tests deterministic, isolated, parallel-safe; no arbitrary sleeps.
- Mock at process/provider boundaries, not every internal function.
- Add regression tests for production bugs at the lowest reliable level.
- Treat flaky tests as defects.

Reviewers **MUST NOT** waive isolation failures.

---

## 16. Git workflow

See also [`docs/git-workflow.md`](./docs/git-workflow.md) and [`docs/commit-convention.md`](./docs/commit-convention.md).

**MUST**

- Integrate via short-lived branches into protected **`main`**; squash merge by default.
- Name branches: `<type>/<ticket>-<short-kebab>` (e.g. `feat/RPM-123-lease-activate`).
- Use Conventional Commits enforced by commitlint:

```text
type(optional-scope): imperative summary
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`.

- Run Husky hooks: `pre-commit` → lint-staged; `commit-msg` → commitlint.
- Update `CHANGELOG.md` `[Unreleased]` for user-visible or operationally meaningful changes.

**MUST NOT**

- Commit secrets, `.env` (except `.env.example`), credentials, `node_modules`, build artifacts, or dumps.
- Force-push or directly push to protected `main`.
- Use `--no-verify` unless emergency-approved and documented in the PR.

---

## 17. Pull Request checklist

Copy into the PR or confirm via `.github/pull_request_template.md`:

- [ ] Problem and intended outcome stated
- [ ] Ticket / sprint scope linked; no out-of-sprint business features without agreement
- [ ] Docs/ADR updated when architecture, API, DB, auth, money, or UI contracts change
- [ ] Conventional Commits used; PR title squash-friendly
- [ ] No secrets / `.env` / credentials in the diff
- [ ] Organization isolation impact reviewed (or N/A with rationale)
- [ ] Authn/authz impact reviewed (or N/A)
- [ ] API / OpenAPI / contracts updated when transport changes
- [ ] Prisma migration + expand/contract notes when schema changes
- [ ] Observability / runbook notes when operational behavior changes
- [ ] Tests added/updated, including isolation negatives when touching org-owned paths
- [ ] UI: loading/empty/error/forbidden states + a11y considered; screenshots attached
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` (and Prisma validate) green locally/CI
- [ ] Rollback / forward-fix plan for risky changes
- [ ] `CHANGELOG.md` updated when required

---

## 18. Code review checklist

Reviewers assess at least:

### Correctness & domain
- [ ] Matches approved docs / sprint scope; no silent redesign
- [ ] Canonical vocabulary respected (Organization, Resident, Unit, Bed, Lease)
- [ ] Invariants live in domain/application—not controllers or UI

### Security & tenancy
- [ ] No `X-Tenant-ID` / caller-selected org headers
- [ ] Trusted Organization context established before authz and persistence
- [ ] Repository methods require context and always filter by org
- [ ] Wrong-org behavior is non-disclosure (`404` pattern) where specified
- [ ] Tokens not stored in forbidden client storage
- [ ] Deny-by-default authorization; sensitive actions audited

### Data & money
- [ ] Money uses decimal-string + currency; no float arithmetic
- [ ] Transactions short; outbox used when DB+async must stay consistent
- [ ] Occupancy/financial contested paths use proper locking/idempotency

### API & contracts
- [ ] problem+json via central mapper; no ad hoc envelopes
- [ ] Pagination bounded; DTOs not Prisma leaks
- [ ] OpenAPI/events updated; breaking changes versioned/deprecated

### Frontend
- [ ] Thin Next.js pages; feature boundaries intact
- [ ] Query keys include `organizationId`; org switch purges state
- [ ] Semantic tokens; WCAG 2.2 AA considered
- [ ] Client checks are UX-only

### Quality
- [ ] Tests cover happy path + isolation negatives for touched surfaces
- [ ] Logging redacts secrets; correlation IDs present where expected
- [ ] Maintainability: naming, module boundaries, no drive-by scope creep

**Review bar:** ≥1 qualified reviewer; **2** for security, tenancy, authorization, financial, or high-risk migration changes. `CODEOWNERS` applies to contracts, auth, tenancy, billing/payments, migrations, and infrastructure.

---

## 19. Exceptions

An exception **MUST** state: rule bypassed, why impractical, security/reliability/maintenance impact, compensating controls, owner, and expiry. Temporary exceptions are tracked work and must be removed or renewed explicitly.

ADR **MUST** precede material changes to: Organization isolation; money/ledger/allocation; authentication/session/JWT org claims/authorization/privileged access.
