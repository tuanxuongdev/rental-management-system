# 08. Folder Structure and Module Boundaries

## 1. Purpose

This document defines the proposed repository layout, ownership boundaries, dependency rules, and naming conventions for a production, multi-tenant Rental Property Management SaaS. The platform is expected to grow from approximately 30 units to 10,000+ units without requiring an early microservice split.

The canonical architecture is:

- A `pnpm` workspace monorepo.
- **Next.js App Router** (React + TypeScript) for the web application — see [`CODING_RULES.md`](../CODING_RULES.md) stack note. Early drafts of this file described a Vite SPA; **that layout is not implemented** and must not be reintroduced without an ADR.
- NestJS for the HTTP API and background worker.
- PostgreSQL through Prisma, Redis, and S3-compatible object storage.
- A modular monolith first, with explicit boundaries that permit later extraction.

The trees below are documentation of the intended structure. They do not imply that every directory must be created before it is needed.

**Implemented Prisma migrations** live under `prisma/schema/migrations/` (immutable, forward-only). The historical `prisma/migrations/` path in some trees below is superseded by that location.
## 2. Repository Structure

```text
rental-property-management/
├── apps/
│   ├── web/                         # Browser application
│   ├── api/                         # NestJS HTTP API
│   └── worker/                      # NestJS asynchronous/background processing
├── packages/
│   ├── ui/                          # Shared presentation components and design tokens
│   ├── contracts/                   # Cross-process API/event schemas and generated types
│   ├── config/                      # Shared build, lint, TypeScript, and runtime config helpers
│   └── testing/                     # Test fixtures, factories, helpers, and contract test utilities
├── prisma/
│   ├── schema/                      # Split Prisma schema files by bounded module
│   ├── migrations/                  # Immutable, ordered database migrations
│   ├── raw-sql/                     # Reviewed PostgreSQL-only migration fragments
│   ├── seeds/                       # Explicit local/demo seed orchestration
│   └── README.md                    # Migration, generation, and seeding instructions
├── docs/                            # Architecture, standards, runbooks, and ADRs
│   ├── adr/                         # Architecture Decision Records
│   ├── runbooks/                    # Operational and incident procedures
│   └── api/                         # API conventions and integration guidance
├── tooling/
│   ├── scripts/                     # Repository maintenance and CI scripts
│   └── generators/                  # Approved module/component scaffolding
├── infrastructure/
│   ├── docker/                      # Local container definitions
│   ├── terraform/                   # Cloud infrastructure, if adopted
│   └── monitoring/                  # Dashboards, alerts, and telemetry configuration
├── .github/
│   ├── workflows/                   # CI/CD workflows
│   ├── CODEOWNERS
│   └── pull_request_template.md
├── pnpm-workspace.yaml
├── package.json                     # Root scripts only; no application logic
├── tsconfig.base.json
├── eslint.config.js
├── prettier.config.js
├── turbo.json                       # Optional task orchestration/cache configuration
├── .env.example                     # Safe names and examples; never real secrets
└── README.md
```

### Root-level responsibilities

- `apps` contains deployable processes. Code in one app must not import source files from another app.
- `packages` contains intentionally reusable libraries. A package must have a clear public API and owner.
- `prisma` is the single source of truth for relational persistence and database migrations.
- `infrastructure` contains deployment and observability configuration, not business logic.
- `tooling` contains development automation and generators, not runtime dependencies.
- `docs` records decisions, operating procedures, and product-engineering standards.

### Prisma domain layout

Prisma schema files follow the same domain vocabulary as applications:

```text
prisma/
├── schema/
│   ├── base.prisma                  # Generator and datasource only
│   ├── identity.prisma
│   ├── tenancy.prisma               # SaaS Organization boundary/membership
│   ├── inventory.prisma             # Property, Unit, optional Bed
│   ├── parties.prisma
│   ├── leasing.prisma
│   ├── billing.prisma
│   ├── payments.prisma
│   ├── utilities.prisma
│   ├── maintenance.prisma
│   ├── documents.prisma
│   ├── communications.prisma
│   ├── reporting.prisma
│   ├── audit.prisma
│   └── imports.prisma
├── migrations/
└── raw-sql/
    ├── exclusion-constraints/       # Occupancy/date-range overlap protection
    └── README.md                    # Ownership, review, test, rollback rules
```

Cross-domain relations are declared on both sides and reviewed by both owners. `raw-sql` is not an alternate migration runner: exclusion constraints and other Prisma-unsupported PostgreSQL DDL are copied into an ordered migration, tested against real PostgreSQL, and tracked with rationale and rollback/forward-fix guidance.

## 3. Frontend Structure: `apps/web`

Use a feature-oriented structure on **Next.js App Router**. Thin `src/app` route files compose domain UI from `src/features/<domain>`. Generic visual primitives belong in `packages/ui`. See [ADR-0005](./adr/0005-nextjs-app-router.md).

```text
apps/web/
├── public/
├── src/
│   ├── app/                         # Next.js App Router (thin routes only)
│   │   ├── (public)/                # login, MFA, invites, password flows
│   │   ├── (app)/app/               # authenticated staff shell routes
│   │   │   ├── admin/               # users, roles, settings, imports
│   │   │   ├── portfolio/           # properties, units, owners, agreements
│   │   │   ├── operations/          # Operations Center
│   │   │   └── layout.tsx
│   │   ├── layout.tsx
│   │   └── providers.tsx            # Query, auth, theme boundaries
│   ├── features/
│   │   ├── admin/
│   │   ├── inventory/               # Properties, Units, optional Beds
│   │   ├── parties/                 # Property Owners / agreements
│   │   ├── imports/                 # Import wizard + operations UI
│   │   └── …                        # leasing/billing as those sprints land
│   ├── components/                  # App-specific cross-feature components
│   ├── lib/                         # Transport adapters (`*-api.ts`); see CODING_RULES
│   ├── state/                       # Minimal cross-feature client state (no tokens)
│   ├── styles/
│   └── types/                       # Web-only types; not transport contracts
├── next.config.ts
├── tsconfig.json
└── package.json
```

Recommended internal feature shape:

```text
features/inventory/
├── components/
├── hooks/                           # TanStack Query hooks
├── utils/
└── index.ts                         # Deliberate public surface
```

Optional later: colocate `features/<domain>/api/` when a feature outgrows shared `lib/*-api.ts` adapters (documented convention in `CODING_RULES.md`).

### Frontend boundaries

1. `app/` route files compose features and must contain little business logic.
2. A feature may import shared UI, contracts, config, and app-level infrastructure. It must not reach into another feature's private directories.
3. Cross-feature access goes through the target feature's `index.ts` public API or an application-level orchestration module.
4. Server state belongs in TanStack Query. Do not duplicate it into a global client store.
5. Authorization checks in the browser improve UX only; the API remains authoritative.
6. Components in `packages/ui` must not depend on application routes, domain terminology, API clients, or tenant state.
7. Transport contracts live in `@rpm/contracts`; do not hand-edit generated OpenAPI clients if/when introduced.

## 4. API Structure: `apps/api`

Organize the NestJS API by business module, not by technical layer across the whole application.

```text
apps/api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── bootstrap/
│   │   ├── configuration.ts
│   │   ├── validation.ts
│   │   ├── openapi.ts
│   │   └── observability.ts
│   ├── common/
│   │   ├── auth/                    # Guards/decorators shared across modules
│   │   ├── context/                 # Request, actor, tenant, correlation context
│   │   ├── errors/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   └── observability/
│   ├── infrastructure/
│   │   ├── database/                # Prisma client lifecycle and transaction helpers
│   │   ├── cache/                   # Redis adapters
│   │   ├── storage/                 # S3 adapters and signed URL policies
│   │   ├── messaging/               # Queue/outbox infrastructure
│   │   ├── email/
│   │   └── payments/                # Payment provider adapter
│   └── modules/
│       ├── identity/
│       ├── tenancy/
│       ├── inventory/               # Properties, Units, optional Beds
│       ├── parties/                 # People and CRM organizations
│       ├── leasing/
│       ├── billing/
│       ├── payments/
│       ├── utilities/
│       ├── maintenance/
│       ├── documents/
│       ├── communications/
│       ├── reporting/
│       ├── audit/
│       └── imports/
├── test/
│   ├── integration/
│   ├── contract/
│   └── e2e/
├── nest-cli.json
├── tsconfig.json
└── package.json
```

Recommended internal module shape:

```text
modules/leasing/
├── application/
│   ├── commands/
│   ├── queries/
│   ├── dto/
│   └── services/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── events/
│   ├── policies/
│   └── repositories/                # Interfaces/ports
├── infrastructure/
│   ├── persistence/                 # Prisma implementations and mappers
│   └── integrations/
├── presentation/
│   ├── controllers/
│   └── presenters/
├── leasing.module.ts
└── index.ts                         # Explicit exports for other modules
```

Not every module needs every layer on day one. Keep small modules simple, but preserve the direction of dependencies:

```text
presentation -> application -> domain
infrastructure -> application/domain ports
domain -> no NestJS, Prisma, Redis, S3, or HTTP dependencies
```

### API module boundaries

- Controllers validate transport input, invoke application use cases, and map results. They do not query Prisma directly.
- Application services coordinate transactions, policies, repositories, events, and integrations.
- Domain code expresses business invariants and must be testable without NestJS or infrastructure.
- Persistence implementations are private to their owning module.
- A module must not query another module's tables merely to bypass its public API. Cross-module read models are allowed only when explicitly documented for reporting or performance.
- Synchronous cross-module calls use exported application interfaces. Asynchronous side effects use durable events/outbox processing where delivery matters.
- Circular module dependencies are prohibited. Resolve them through orchestration, events, or boundary redesign rather than `forwardRef`.
- Every tenant-owned query and mutation requires tenant context at the repository boundary.

## 5. Worker Structure: `apps/worker`

The worker is independently deployable but shares contracts and approved infrastructure abstractions. It must not import implementation code from `apps/api`.

```text
apps/worker/
├── src/
│   ├── main.ts
│   ├── worker.module.ts
│   ├── bootstrap/
│   ├── common/
│   │   ├── context/                 # Job, tenant, actor, and correlation context
│   │   ├── observability/
│   │   └── errors/
│   ├── infrastructure/
│   │   ├── database/
│   │   ├── queue/
│   │   ├── storage/
│   │   ├── email/
│   │   └── payments/
│   └── modules/                     # Mirrors API business-module names
│       ├── inventory/
│       │   └── handlers/
│       ├── parties/
│       │   └── handlers/
│       ├── leasing/
│       │   └── handlers/
│       ├── billing/
│       │   └── handlers/
│       ├── payments/
│       │   └── handlers/
│       ├── utilities/
│       │   └── handlers/
│       ├── maintenance/
│       │   └── handlers/
│       ├── documents/
│       │   └── handlers/
│       ├── communications/
│       │   └── handlers/
│       ├── reporting/
│       │   └── handlers/
│       ├── identity/
│       │   └── handlers/
│       ├── tenancy/
│       │   └── handlers/
│       ├── audit/
│       │   └── handlers/
│       └── imports/
│           └── handlers/
├── test/
│   ├── integration/
│   └── e2e/
├── nest-cli.json
├── tsconfig.json
└── package.json
```

Worker requirements:

- Worker module names mirror API domain names so ownership, contracts, dashboards, and queue policies remain discoverable. A module contains job handlers and worker-only orchestration, not copied API implementation.
- Jobs are idempotent and safe to retry.
- Payloads contain stable identifiers, tenant ID, schema version, correlation ID, and trace context; avoid large or sensitive snapshots.
- Retry, timeout, dead-letter, and concurrency policies are explicit per job.
- Business-critical publishing uses a transactional outbox or equivalent durable mechanism.
- A job handler delegates to a use case and does not become an untestable script.

## 6. Shared Packages

### `packages/ui`

```text
packages/ui/
├── src/
│   ├── components/
│   ├── primitives/
│   ├── patterns/
│   ├── tokens/
│   ├── accessibility/
│   └── index.ts
├── stories/
├── test/
└── package.json
```

Owns accessible, application-agnostic visual building blocks. It may depend on React and approved styling libraries, but not on `apps/web`, domain modules, or API infrastructure.

### `packages/contracts`

```text
packages/contracts/
├── src/
│   ├── openapi/                     # Source/validated OpenAPI and generated types
│   ├── events/                      # Versioned event and job-envelope schemas
│   ├── common/
│   └── index.ts
├── test/
└── package.json
```

Owns the canonical OpenAPI contract, generated API types, versioned event/job schemas, event envelopes, pagination/error contracts, and types inferred from runtime schemas. It must not contain entities, repositories, business services, credentials, or environment-specific behavior. API, web, and worker communicate through these contracts; sharing contracts never permits one app to import another app.

### `packages/config`

```text
packages/config/
├── eslint/
├── typescript/
├── test/
├── runtime/                         # Typed environment parsing helpers
└── package.json
```

Owns shared tool configuration and small typed configuration helpers. Applications retain ownership of their actual environment schema.

### `packages/testing`

```text
packages/testing/
├── src/
│   ├── factories/
│   ├── fixtures/
│   ├── builders/
│   ├── database/
│   ├── contracts/
│   └── assertions/
└── package.json
```

Owns reusable test-only utilities. It must never be a production dependency and must not become a home for hidden business logic.

## 7. Workspace Dependency Rules

Allowed high-level dependencies:

```text
apps/web    -> packages/ui, packages/contracts, packages/config
apps/api    -> packages/contracts, packages/config
apps/worker -> packages/contracts, packages/config
tests       -> packages/testing
packages/ui -> packages/config (tooling only)
```

Prohibited dependencies:

- `packages/*` importing from `apps/*`.
- One app importing another app's source.
- `packages/contracts` importing NestJS controllers, Prisma models, React components, or app configuration.
- Production code importing `packages/testing`.
- Deep imports that bypass a package's documented exports.
- Domain code importing framework or persistence implementation types.
- Shared packages created solely to avoid deciding which module owns behavior.

Enforcement mechanisms should include:

- Package `exports` maps.
- TypeScript project references or equivalent isolated builds.
- ESLint import-boundary rules.
- Dependency graph checks in CI.
- `CODEOWNERS` for security-critical and shared boundaries.

## 8. Data Ownership and Multi-Tenant Boundaries

- Every tenant-owned record has an explicit, non-null `tenantId`, except where a documented parent-enforced design is demonstrably safe.
- Foreign keys and unique constraints include tenant scope where required to prevent cross-tenant references or collisions.
- Repositories require a `TenantContext`; callers do not pass arbitrary tenant IDs as optional filters.
- Global platform data and tenant-owned data are modeled separately.
- Identity, tenant membership, role assignment, audit, and billing/payment records are security-sensitive modules with named owners.
- Reporting may use read-optimized queries, views, or replicas, but tenant filtering remains mandatory and tested.
- S3 object keys are tenant-scoped; object access is mediated by authorization and short-lived signed URLs.
- Redis keys include environment and tenant scope where data is tenant-owned.

## 9. Naming Conventions

### Organization terminology

- `tenancy` owns the SaaS **Organization** security boundary, memberships, subscriptions, and organization-scoped policy.
- `parties` owns people and external business/legal organizations such as owners, vendors, employers, and agencies.
- Never create a generic `organizations` feature/module because it conflates CRM parties with the SaaS boundary. Use explicit model names such as `SaasOrganization` only where code would otherwise be ambiguous; user-facing language remains **Organization** for the SaaS boundary.
- Canonical inventory hierarchy is `Property > Unit > optional Bed`; folders and symbols must not use `room` as a synonym for Unit.

### Files and directories

- Directories: `kebab-case`.
- TypeScript source files: `kebab-case.ts` or conventional framework suffixes.
- React components: `PascalCase.tsx`; one primary component per file.
- React hooks: `use-feature-name.ts`.
- NestJS: `*.controller.ts`, `*.service.ts`, `*.module.ts`, `*.guard.ts`, `*.interceptor.ts`, `*.repository.ts`.
- Tests: `*.spec.ts`, `*.spec.tsx`, or `*.e2e-spec.ts`.
- Stories: `*.stories.tsx`.
- Prisma migrations: generated timestamp plus descriptive `snake_case` name.
- ADRs: `NNNN-short-decision-title.md`.

### Symbols

- Classes, components, types, and interfaces: `PascalCase`.
- Functions, variables, and object properties: `camelCase`.
- True constants and environment variable names: `UPPER_SNAKE_CASE`.
- Boolean names begin with `is`, `has`, `can`, `should`, or `was`.
- Collections use plural nouns; single entities use singular nouns.
- IDs are explicit (`tenantId`, `leaseId`), never generic `id` outside the entity's own scope.
- Commands use imperative verbs (`CreateLeaseCommand`); events use past tense (`LeaseActivated`).

### Database and API

- Prisma models and enums: `PascalCase`; Prisma fields: `camelCase`.
- Physical PostgreSQL tables and columns: `snake_case` through `@@map` and `@map`.
- Primary keys use a consistent platform-wide strategy; do not mix formats casually.
- API resource paths use plural `kebab-case` nouns, such as `/v1/lease-charges`.
- JSON fields use `camelCase`.
- Query parameters use `camelCase`.
- Dates are ISO 8601; timestamps are UTC with offsets. Monetary values use integer minor units plus ISO currency code, or a reviewed decimal strategy.

## 10. When to Add or Extract a Module

Create a module when the capability has distinct business language, invariants, permissions, data ownership, or release risk. Do not create a shared module merely because two files look similar.

Consider extracting a module into a service only when evidence shows a need, such as:

- Independent scaling or availability requirements.
- A distinct security or compliance boundary.
- A separate team with clear ownership.
- Deployment coupling that materially slows delivery.
- Resource contention that cannot be handled within the modular monolith.

Extraction requires an ADR, stable contracts, ownership of data, operational readiness, and a migration/rollback plan. Repository structure alone is not justification for distributed architecture.

## 11. Required Architecture Decisions

An accepted ADR in `docs/adr/` is mandatory before implementing or materially changing:

- tenancy and Organization-boundary propagation, data ownership, support access, or isolation controls;
- money representation, rounding, ledger behavior, allocation, reconciliation, or accounting-date policy;
- authentication/session/token strategy, organization-scoped JWT claims, authorization model, or privileged access.

ADRs state context, decision, alternatives, security and migration consequences, owner, and review trigger. Pull requests affecting these areas link the applicable ADR; CI/review templates treat a missing decision as a merge blocker.
