# Contributing

Thanks for contributing to **Rental Property Management**.

This repository is a `pnpm` monorepo. Documentation under [`docs/`](./docs) is **normative**. Binding implementation rules are in [`CODING_RULES.md`](./CODING_RULES.md). Coding agents must also follow [`AGENTS.md`](./AGENTS.md) and [`CLAUDE.md`](./CLAUDE.md).

Do **not** redesign architecture, database design, API contracts, permission model, or UI specifications without an approved documentation change (and ADR when required).

## Before you start

1. Read [`README.md`](./README.md) and [`CODING_RULES.md`](./CODING_RULES.md).
2. Read [`docs/git-workflow.md`](./docs/git-workflow.md) and [`docs/commit-convention.md`](./docs/commit-convention.md).
3. Follow [`docs/09-coding-standard.md`](./docs/09-coding-standard.md) and [`docs/08-folder-structure.md`](./docs/08-folder-structure.md).
4. Use Node.js **20.11+** and pnpm **9+** (`corepack enable`).
5. Copy `.env.example` → `.env` for local work. **Never commit secrets.**

## Development setup

```bash
pnpm install
pnpm prisma:generate
pnpm build
pnpm lint
pnpm typecheck
```

Optional local services:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up postgres redis -d
```

Quality gates (also in CI):

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm prisma:validate
pnpm build
```

## Architecture constraints (summary)

- Modular monolith: `apps/api` + `apps/worker`; Next.js App Router in `apps/web`.
- Organization isolation from authenticated org-scoped JWT/session—**never** `X-Tenant-ID` or caller-selected org headers.
- Canonical vocabulary: Organization, Resident, Lease, Unit, Bed — no Room-as-Unit; no renter-as-tenant APIs.
- Money: decimal strings + ISO 4217; no floating-point currency math.
- Nest layering: `presentation → application → domain`; Prisma only in infrastructure.
- Frontend: TanStack Query for server state; Zustand only for minimal client/UI state; semantic Tailwind tokens via `packages/ui`.

Full detail: [`CODING_RULES.md`](./CODING_RULES.md).

## Branching

Create a focused branch from `main`:

```text
feat/RPM-123-short-description
fix/RPM-456-short-description
chore/RPM-789-short-description
hotfix/RPM-101-critical-description
```

See [`docs/git-workflow.md`](./docs/git-workflow.md). Prefer short-lived branches and squash merge into protected `main`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
type(optional-scope): imperative summary
```

Examples:

```text
feat(leases): enforce unit occupancy constraints
fix(billing): prevent duplicate recurring charges
docs(git): document contribution workflow
```

Husky:

- **pre-commit:** lint-staged (ESLint + Prettier)
- **commit-msg:** commitlint

Do not use `--no-verify` unless an emergency is approved and documented in the PR.

## Pull Request checklist

Every PR must include the fields in [`.github/pull_request_template.md`](./.github/pull_request_template.md) and confirm:

- [ ] Problem and intended outcome are clear
- [ ] Ticket / sprint scope is linked; no unauthorized business scope creep
- [ ] Docs/ADR updated when architecture, API, DB, auth, money, or UI contracts change
- [ ] Conventional Commits; squash-friendly title
- [ ] No secrets or `.env` files in the diff
- [ ] Organization-isolation impact reviewed (or N/A with rationale)
- [ ] Authn/authz impact reviewed (or N/A)
- [ ] API / OpenAPI / `packages/contracts` updated when transport changes
- [ ] Prisma migration + expand/contract / rollback notes when schema changes
- [ ] Observability / runbook notes when operational behavior changes
- [ ] Tests added/updated — including isolation negatives for org-owned paths
- [ ] UI: loading/empty/error/forbidden + accessibility considered; screenshots when visible
- [ ] CI green: format, lint, typecheck, Prisma validate, build (and applicable tests)
- [ ] Rollback / forward-fix plan for risky changes
- [ ] `CHANGELOG.md` `[Unreleased]` updated when user-visible or operationally meaningful

Keep PRs small and independently reviewable. Prefer squash merge.

## Code review checklist

Reviewers verify (see also [`CODING_RULES.md`](./CODING_RULES.md) §18):

### Correctness & domain
- [ ] Matches approved docs / sprint; no silent redesign
- [ ] Canonical vocabulary respected
- [ ] Invariants in domain/application—not controllers or UI

### Security & tenancy
- [ ] No caller-selected Organization headers or body-based tenancy proof
- [ ] Trusted Organization context before authz and persistence
- [ ] Repositories require context and always filter by Organization
- [ ] Wrong-org access follows non-disclosure rules (`404` where specified)
- [ ] Tokens not stored in forbidden client storage
- [ ] Deny-by-default authorization; sensitive actions audited

### Data & money
- [ ] Decimal-string money + currency; no float arithmetic
- [ ] Short transactions; outbox when DB + async must stay consistent
- [ ] Contested occupancy/financial paths use locking / idempotency

### API & contracts
- [ ] `application/problem+json` via central mapper
- [ ] Bounded pagination; no Prisma models leaked as API DTOs
- [ ] Contracts/OpenAPI updated; breaking changes versioned or deprecated

### Frontend
- [ ] Thin Next.js pages; feature module boundaries intact
- [ ] Query keys include `organizationId`; org switch purges prior-org state
- [ ] Semantic design tokens; WCAG 2.2 AA considered
- [ ] Client permission checks are UX-only

### Quality
- [ ] Isolation and regression tests present for touched surfaces
- [ ] Logs redact secrets; correlation IDs where expected
- [ ] No unrelated drive-by refactors

**Review bar:** ≥1 qualified reviewer; **2** for security, tenancy, authorization, financial, or high-risk migration changes. `CODEOWNERS` applies to shared contracts, auth, tenancy, billing/payments, migrations, and infrastructure.

Authors resolve comments with code, evidence, or explicit rationale—do not silently dismiss concerns.

## Code of conduct and security

- Participate under [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- Report vulnerabilities privately per [`SECURITY.md`](./SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the MIT License ([`LICENSE`](./LICENSE)).
