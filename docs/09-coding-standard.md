# 09. Coding and Delivery Standard

## 1. Scope

This standard applies to all production code, tests, migrations, infrastructure configuration, and shared packages in the Rental Property Management SaaS monorepo. Its goals are correctness, Organization isolation, maintainability, secure operation, and predictable delivery from approximately 30 to 10,000+ units.

Rules marked **MUST** are mandatory. Exceptions require a documented rationale in the pull request and approval from the responsible technical owner. Repeated or architectural exceptions require an Architecture Decision Record (ADR).

## 2. Baseline Engineering Principles

- Prefer simple, explicit code over clever abstraction.
- Build a modular monolith with enforceable boundaries before considering services.
- Keep business invariants in domain/application code, not controllers or UI components.
- Treat tenant isolation, authorization, auditability, and data integrity as correctness requirements.
- Validate all untrusted input at a system boundary.
- Make side effects observable, idempotent where retried, and recoverable.
- Automate repeatable checks in CI rather than relying on reviewer memory.
- Delete obsolete code instead of retaining commented-out implementations.

## 3. TypeScript Standard

### Compiler and package settings

All packages **MUST** use strict TypeScript settings inherited from the root configuration, including:

- `strict`
- `noImplicitOverride`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `noFallthroughCasesInSwitch`
- `useUnknownInCatchVariables`
- `forceConsistentCasingInFileNames`

Packages **MUST** build independently and expose only intentional entry points through package `exports`.

### Types

- Do not use `any`. A narrowly scoped, documented exception is allowed only at an unsafe third-party boundary. Prefer `unknown` plus validation or narrowing.
- Prefer inferred local types and explicit public function/return types at package and module boundaries.
- Use discriminated unions for state machines and variant results.
- Avoid TypeScript `enum` for external contracts; use runtime schemas and literal unions unless a reviewed interoperability need exists.
- Do not use non-null assertions (`!`) to silence uncertainty. Prove the invariant, guard it, or redesign the type.
- Avoid type assertions (`as`) except after validation or in tightly constrained adapter code.
- Use `readonly` for immutable inputs and structures where practical.
- Distinguish identifiers using branded/opaque types where accidental ID interchange is a material risk.
- Currency amounts **MUST** use the approved arbitrary-precision decimal value object/library plus an ISO 4217 currency code. JavaScript/TypeScript `number`, binary floating point, implicit coercion, and ad hoc integer-minor-unit arithmetic are forbidden for currency fields and calculations. Transport values are decimal strings; rounding occurs only through named, tested policies.
- Store and exchange timestamps in UTC. Preserve a property's business timezone separately for local billing and due-date rules.

### Functions and errors

- Functions should perform one coherent operation and use descriptive verbs.
- Prefer parameter objects once a function has several same-typed or optional parameters.
- Do not return `null` and `undefined` interchangeably; define one meaning per API.
- Do not swallow errors. Handle, translate, or propagate them with context.
- Exhaustively handle discriminated unions; unhandled variants must fail compilation.
- Asynchronous calls must be awaited, returned, or intentionally detached through an approved background mechanism with error reporting.

### Formatting and linting

- Formatting is owned by Prettier and must not be debated in review.
- ESLint runs with zero warnings in CI.
- Imports are ordered consistently and unused imports are prohibited.
- Deep package imports and boundary violations are CI failures.
- Source files use UTF-8 and LF line endings.

## 4. React Standard

### Component design

- Use function components and hooks.
- Components should be accessible by default and usable with keyboard and assistive technology.
- Route pages orchestrate features; reusable domain UI stays within its feature; application-agnostic primitives belong in `packages/ui`.
- Keep render functions free of side effects.
- Do not store values in state when they can be derived from props, server state, or existing state.
- Avoid premature memoization. Add `memo`, `useMemo`, or `useCallback` only for demonstrated referential requirements or measured performance.
- Stable list keys must represent entity identity; array indexes are not keys for reorderable or mutable lists.

### Data and state

- Use the approved query library for server state, caching, retries, invalidation, and mutations.
- Keep global client state minimal. Tenant selection, authenticated actor, and narrowly shared UI state are acceptable; fetched domain collections are not duplicated globally.
- API calls go through the approved typed client and feature query/mutation modules.
- Forms use runtime schemas aligned with API contracts while retaining UI-specific validation and messages.
- Loading, empty, error, forbidden, and partial-data states must be designed deliberately.
- Optimistic updates require a rollback path and are avoided for high-risk financial actions unless the server protocol supports them safely.

### Security and authorization

- The web application never decides authoritative access. Client permission checks are presentation behavior only.
- Access and refresh tokens **MUST NOT** be stored in `localStorage`, `sessionStorage`, IndexedDB, service-worker caches, persisted client stores, or readable cookies. Use secure, HTTP-only, same-site cookies or an approved in-memory access-token design.
- Never render unsanitized HTML. Any exceptional rich-text rendering requires an approved sanitizer and security review.
- Sensitive values must not appear in URLs, analytics events, browser logs, or client error reports.
- Every organization-scoped query key **MUST** include the trusted active `organizationId`.
- Organization switches **MUST** cancel in-flight requests and purge all previous-organization queries, mutations, persisted caches, prefetched data, and local drafts before new-organization content renders. Partitioning alone is insufficient.

### Accessibility and performance

- Target WCAG 2.2 AA for user workflows.
- Use semantic HTML before ARIA; every input has an accessible label and errors are programmatically associated.
- Dialog focus, keyboard navigation, and focus restoration must be tested.
- Large tables use server pagination/filtering and virtualization where measured.
- Route-level code splitting is expected; bundle regressions are monitored in CI.

## 5. NestJS Standard

### Responsibilities

- Controllers handle HTTP concerns, DTO validation, authentication context, status codes, and response mapping.
- Application services/use cases coordinate business operations and transaction boundaries.
- Domain objects and policies enforce business invariants without framework dependencies.
- Repositories and adapters isolate Prisma, Redis, S3, queues, email, and payment providers.
- Modules expose a minimal public API and must not rely on circular dependencies or `forwardRef`.

### Dependency injection

- Constructor injection is required.
- Inject interfaces/tokens at boundaries, especially for external providers and persistence.
- Avoid service-locator patterns and global mutable singletons.
- Request context must be explicit and safe under concurrent requests; do not store tenant or actor state in process-global variables.

### Validation and transport

- Request processing **MUST** apply controls in this order: authentication (authn) → trusted Organization context establishment → authorization (authz) → DTO/body validation → controller/use case. A resource identifier or request body cannot establish Organization context.
- Every external DTO is runtime validated with an allowlist strategy; unknown properties are rejected or stripped according to a documented API policy.
- Transformations must not hide invalid input.
- Controllers return documented DTOs, not raw Prisma records.
- OpenAPI is generated and checked for accidental breaking changes.
- Pagination is bounded. Endpoints must not expose unbounded list operations.
- File uploads enforce content type, extension policy, size limits, malware scanning where appropriate, and authorized tenant-scoped storage.

### Transactions and side effects

- A use case defines the transaction boundary; controllers do not.
- Keep database transactions short and do not hold them open across remote network calls.
- Use an outbox or equivalent durable pattern when a database commit and asynchronous event must remain consistent.
- Retried commands and webhook handlers must be idempotent using a stable idempotency key.
- Payment provider callbacks require signature verification, replay protection, and durable raw-event references.

## 6. Prisma and PostgreSQL Standard

### Schema

- Models use singular `PascalCase`; fields use `camelCase`; physical tables and columns use `snake_case` mappings.
- Every tenant-owned model includes non-null tenant scope and appropriate indexes.
- Relations define both sides and explicit referential actions.
- Foreign keys are mandatory unless a documented ingestion or partitioning constraint prevents them.
- Frequently queried tenant-scoped access patterns receive composite indexes beginning with `tenantId` where appropriate.
- Unique constraints include tenant scope when uniqueness is tenant-local.
- Use explicit status fields and reviewed state transitions rather than inferring critical state from nullable timestamps.
- Include `createdAt` and `updatedAt`; use actor/audit fields where accountability requires them.
- Soft delete is not a default. When required, define uniqueness, query, restoration, retention, and audit behavior.
- Prisma-generated types do not cross API or domain boundaries as public contracts.

### Query practices

- Every repository method **MUST** take a non-optional `RepositoryContext`. Organization-owned methods accept an `OrganizationContext` containing trusted `organizationId`; platform-only methods accept a distinct `PlatformContext` and cannot be called with Organization context. Optional `tenantId`/`organizationId` parameters and context-free overloads are forbidden.
- Every Organization-owned Prisma query and mutation **MUST** include the trusted Organization filter at the repository boundary, including relation lookup, aggregate, update, delete, and existence checks.
- Avoid `findUnique({ id })` for Organization-owned resources unless database constraints and repository design prove Organization scope. Prefer Organization-scoped compound keys or a scoped `findFirst`.
- Select only required fields for hot or sensitive paths.
- Detect and prevent N+1 query patterns.
- Use cursor pagination for large or changing datasets; offset pagination is acceptable for small administrative lists with documented limits.
- Application use of Prisma `$queryRaw`, `$queryRawUnsafe`, `$executeRaw`, and `$executeRawUnsafe` is forbidden. The only exception is an approved migration helper for Prisma-unsupported DDL, with named security/data-owner review, parameterization where applicable, real-PostgreSQL tests, and migration documentation. `$*RawUnsafe` remains forbidden.
- Financial writes, lease activation, Unit/Bed allocation, and other contested operations use transactions and appropriate locking or optimistic concurrency.

### Enforced Organization scoping

- ESLint/dependency rules restrict direct `PrismaClient` access to approved repository infrastructure and reject repository methods without `RepositoryContext`.
- Repository contract tests call each Organization-owned method with Organization A context and Organization B identifiers and prove no record, count, timing-derived detail, mutation, or existence signal crosses the boundary.
- CI maintains an inventory of repository methods and fails when a new method lacks positive, wrong-Organization, and missing-context tests.
- Review approval cannot waive an isolation failure. Any temporary tooling exception runs with least privilege, is audited, and has an expiry.

## 7. Tenant Context and Security Rules

### Organization context

Every authenticated request and background job must establish a trusted context containing at least:

- `organizationId`
- `actorId` and actor type
- roles/permissions or authorization subject
- correlation/trace ID
- authentication/session reference

The Organization is derived from the authenticated, organization-scoped JWT/session membership or an explicit platform-support workflow, never from arbitrary request data. The JWT's Organization claim is validated against session/membership state according to the authentication ADR.

Organization context **MUST**:

- Be mandatory at repository calls for tenant-owned data.
- Flow into jobs and events through validated envelopes.
- Scope cache keys, object-storage keys, audit records, and rate limits where applicable.
- Be included in structured logs as an identifier, while excluding sensitive tenant content.
- Be tested with negative cross-tenant cases.

The `X-Tenant-ID`, `X-Organization-ID`, or equivalent caller-selected tenant-header pattern is explicitly forbidden. Such a header must never select, override, or prove Organization scope, even for internal APIs. Organization selection occurs through an authorized session/token exchange that issues an organization-scoped JWT.

Platform-administrator access requires a separate, explicit authorization path, reason capture for sensitive actions, and enhanced audit logging. “Super admin” must never silently bypass repository scoping.

### Application security

- Follow OWASP ASVS and OWASP API Security guidance proportionate to risk.
- Authentication uses established libraries and modern protocols; do not implement cryptography or password hashing primitives.
- Authorization is deny-by-default and checked server-side at the action and resource level.
- Passwords use an approved adaptive hash; secrets and tokens are never logged.
- Sessions, refresh tokens, API keys, reset tokens, and invitations have expiry, revocation, rotation, and replay controls.
- Rate-limit authentication, invitations, password reset, exports, uploads, and expensive endpoints.
- Apply CSRF protection when cookie-authenticated state changes are possible.
- Configure CORS by environment with explicit origins.
- Encrypt data in transit and at rest; classify sensitive resident, identity, payment, and document data.
- Use payment-provider tokens; do not store raw card data.
- Audit login, tenant membership changes, permission changes, lease/billing/payment actions, exports, and destructive operations.

## 8. Error Handling

Use a stable application error taxonomy:

- validation/input error
- unauthenticated
- forbidden
- not found
- conflict/business rule violation
- rate limited
- dependency unavailable
- internal error

API errors **MUST** use RFC 9457 `application/problem+json` containing:

- `type`: stable documentation URI or registered problem identifier
- `title`: safe, stable summary
- `status`: HTTP status
- `detail`: safe instance-specific explanation when appropriate
- `instance`: non-sensitive request/resource reference when useful
- extension members for stable application `code`, `correlationId`, and optional field-level validation errors

All controllers and exception paths pass through the central problem mapper; ad hoc error envelopes are forbidden. Internal exceptions, SQL errors, stack traces, Organization data, secrets, and provider payloads **MUST NEVER** be returned to clients in any environment. Translate known errors at module boundaries. Unexpected errors are logged once at the responsible boundary and returned as a generic internal problem.

Financial and state-transition conflicts should return deterministic conflict codes so clients can refresh and recover safely.

## 9. Logging, Audit, and Observability

- Emit structured JSON logs in deployed environments.
- Include timestamp, level, service, environment, version, correlation ID, trace ID, tenant ID, actor ID, operation, duration, and outcome when available.
- Never log passwords, tokens, cookies, authorization headers, reset links, full payment details, sensitive documents, or unnecessary personal data.
- Redact approved sensitive field names centrally.
- Avoid duplicate logging at every layer. Add context while preserving the original cause.
- Use metrics for latency, error rate, throughput, queue depth/age, job retries, database saturation, cache health, payment failures, and billing runs.
- Trace API-to-worker and external-provider flows using propagated trace/correlation context.
- Audit events are durable business/security records, separate from operational logs, and protected from modification.
- Alerts must link to an owner and runbook and be tested before production launch.

## 10. Testing Standard

### Test portfolio

The required testing pyramid is:

1. **Unit (broadest):** domain invariants, policies, decimal money calculations, authorization policies, and pure transformations.
2. **Component/service:** interactive React behavior and accessibility; NestJS use cases with controlled ports.
3. **Integration:** every Prisma repository against real PostgreSQL, transactions, Redis, storage, queues, and provider adapters.
4. **Contract:** API, problem+json, OpenAPI, events, jobs, and backward compatibility.
5. **End-to-end (narrowest):** critical journeys and security boundaries.

Tenant/Organization isolation negative tests are a mandatory merge gate, not optional “security coverage.” Every Organization-owned repository and endpoint must prove same-Organization success, wrong-Organization denial/non-disclosure, missing-context failure, and unauthorized-role denial. Performance tests cover high-volume lists, billing generation, payment reconciliation, exports, and worker backlog recovery.

### Test quality

- Tests follow arrange/act/assert and describe behavior rather than implementation.
- Tests are deterministic, isolated, and parallel-safe.
- Do not use arbitrary sleeps; wait on observable conditions.
- Mock at process or provider boundaries, not every internal function.
- Factories produce valid defaults with explicit overrides.
- Every production bug receives a regression test at the lowest reliable level.
- Coverage is a signal, not the goal. Changed critical business logic should have branch coverage; repository-wide thresholds are ratcheted rather than gamed.
- Flaky tests are treated as defects, assigned an owner, and fixed or quarantined with an expiry.

Minimum required test cases for tenant-owned operations:

1. Authorized access within the tenant.
2. Unauthorized role within the same tenant.
3. Attempted access using another tenant's identifier.
4. Missing or malformed tenant context.
5. Audit behavior for sensitive actions.

## 11. API Design and Change Management

- Version public APIs under `/v1` or an equivalent explicit strategy.
- Use resource-oriented URLs and standard HTTP semantics.
- Mutating financial or externally retried operations support idempotency keys.
- List endpoints use bounded pagination, filtering, sorting allowlists, and stable ordering.
- Timestamps use ISO 8601 UTC; money uses the platform monetary contract.
- Breaking changes require a new version or a documented deprecation window.
- Additive changes must account for strict consumers and generated clients.
- Contract schemas are updated before or with implementation.
- CI detects unintended OpenAPI and event-schema breaking changes.
- Webhooks are signed, versioned, replay-safe, observable, and retryable.

## 12. Database Migration Practices

- Every schema change is represented by a reviewed migration committed with the code.
- Applied migrations are immutable; create a corrective migration instead of editing history.
- Production migrations use an expand/migrate/contract sequence for breaking or large changes:
  1. Add backward-compatible structures.
  2. Deploy code capable of reading/writing both forms.
  3. Backfill in bounded, resumable batches.
  4. Verify counts, constraints, and application behavior.
  5. Switch reads and writes.
  6. Remove obsolete structures in a later release.
- Do not combine a risky long-running migration with the application startup path.
- Index creation, non-null changes, table rewrites, and large backfills require lock/runtime analysis using production-like volume.
- Each production migration has prechecks, expected duration, monitoring, abort criteria, and recovery steps.
- Rollback normally means forward-fixing or rolling application code back while retaining compatible schema. Destructive down migrations are not assumed safe.
- Seed scripts are idempotent where possible and never insert production secrets.
- Production data access and manual SQL require approval and an audit trail.

## 13. Git Workflow

Use short-lived branches and trunk-oriented integration.

Branch naming:

- `feat/RPM-123-short-description`
- `fix/RPM-456-short-description`
- `chore/RPM-789-short-description`
- `hotfix/RPM-101-critical-description`

Rules:

- Branch from the current default branch and rebase/update before merge.
- Keep branches focused and normally short-lived.
- Do not commit generated noise, logs, editor state, credentials, or local environment files.
- `main` (or the configured default branch) **MUST** be protected: pull requests, required approving reviews, current required checks, resolved conversations, and no direct or force pushes.
- Use squash merge unless repository history policy specifies otherwise.
- Direct pushes to protected branches and force pushes are prohibited.

### Conventional Commits

Every commit subject **MUST** follow:

```text
type(optional-scope): imperative summary
```

Approved types include `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, and `revert`.

Examples:

```text
feat(leases): enforce unit occupancy constraints
fix(billing): prevent duplicate recurring charges
docs(architecture): define module dependency rules
```

Use `!` and a `BREAKING CHANGE:` footer for intentional breaking changes. Reference the work item in the commit footer or pull request.

## 14. Pull Requests and Review

Every pull request includes:

- Problem and intended outcome.
- Scope and relevant work item.
- Design/ADR links for consequential decisions.
- Security and tenant-isolation impact.
- API, event, database, configuration, and operational changes.
- Test evidence.
- Screenshots or recordings for visible UI changes.
- Migration, deployment, observability, and rollback notes when relevant.

Review requirements:

- At least one qualified reviewer; two for security-critical, financial, tenancy, authorization, or high-risk migration changes.
- `CODEOWNERS` approval for shared contracts, authentication, tenancy, billing/payments, migrations, and infrastructure.
- Authors resolve comments with code, evidence, or explicit rationale; they do not silently dismiss concerns.
- Reviewers assess correctness, tenant isolation, authorization, transaction behavior, failure modes, tests, observability, accessibility, and maintainability.
- Large pull requests should be split where doing so preserves a safe incremental path.

## 15. CI Quality Gates

A pull request cannot merge unless applicable gates pass:

1. Lockfile integrity and reproducible install.
2. Formatting check.
3. ESLint with zero warnings.
4. TypeScript strict typecheck for affected packages.
5. Unit and component tests.
6. Integration and contract tests.
7. Build of all affected deployables.
8. Prisma schema validation and migration checks.
9. OpenAPI/event contract compatibility check.
10. Dependency vulnerability and license policy scan.
11. Secret scan and static application security scan.
12. Import-boundary/dependency graph validation.
13. Accessibility and bundle-size checks for affected web surfaces.
14. Container/image scan for release artifacts.
15. Tenant/Organization isolation negative-test suite for every affected repository and endpoint.

At minimum, `typecheck`, `lint`, `unit`, `isolation-tests`, and software-composition analysis (`sca`) are named required branch-protection checks and cannot be skipped by changing paths. Required-check configuration is reviewed as code.

The default branch also runs scheduled full end-to-end, cross-browser, performance smoke, and dependency scans. A gate may be waived only through a time-bounded, recorded risk acceptance by an authorized owner.

## 16. Dependency Management

- Use `pnpm` and commit the lockfile.
- Pin the package manager through the repository's `packageManager` field.
- Add dependencies to the narrowest workspace that needs them.
- Prefer mature, actively maintained libraries with acceptable security and licensing.
- Before adding a dependency, assess maintenance, transitive footprint, browser/server compatibility, license, security history, and whether the platform already provides the capability.
- Automated update pull requests are grouped and tested; major upgrades are planned.
- Production dependencies are scanned continuously. Critical exploitable findings receive immediate triage.
- Avoid unreviewed install scripts and packages with suspicious provenance.
- Remove unused dependencies promptly.

## 17. Secrets and Configuration

- Secrets never enter Git, test fixtures, logs, screenshots, issue trackers, or client bundles.
- Use the approved cloud secret manager or deployment platform secret store.
- `.env.example` is the only environment-shaped file permitted in Git and contains names plus safe placeholders only. All `.env`, `.env.*` (except `.env.example`), credential exports, and local overrides are ignored and blocked by CI.
- Each application validates its environment at startup and fails fast on missing or invalid required values.
- Separate configuration from secrets and use environment-specific access controls.
- Rotate credentials regularly and immediately after suspected exposure.
- Prefer short-lived workload identity over long-lived static cloud keys.
- Restrict production secrets by service and least privilege; web, API, and worker do not automatically share all credentials.
- Secret scanning **MUST** run in CI before merge and continuously across repository history; detected credentials block merge and trigger rotation/incident handling rather than simple deletion.

## 18. Exceptions and Evolution

Standards evolve through reviewed pull requests and ADRs. An exception must state:

- The rule being bypassed.
- Why compliance is impractical.
- Security, reliability, and maintenance impact.
- Compensating controls.
- Owner and expiry/review date.

Temporary exceptions must be tracked as work and removed or renewed explicitly.
