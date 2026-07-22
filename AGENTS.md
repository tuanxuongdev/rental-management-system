# AGENTS.md

Mandatory operating instructions for coding agents working in this repository.

## Mission

Implement only what the current task and approved sprint/docs allow. Do **not** invent business features, redesign architecture, or “improve” domain/API/UI specs in code.

## Read first (in order)

1. [`CODING_RULES.md`](./CODING_RULES.md) — binding engineering rules
2. [`CONTRIBUTING.md`](./CONTRIBUTING.md) — human/agent contribution process
3. Relevant normative docs under [`docs/`](./docs):
   - Architecture: `02-system-architecture.md`, `08-folder-structure.md`, `09-coding-standard.md`
   - Data/API/Auth: `03-database-design.md`, `04-api-specification.md`, `05-authentication.md`, `06-permission-system.md`
   - UI: `07-ui-design.md`, `design-system.md`, `navigation.md`, `docs/ui/*`
   - Delivery: `git-workflow.md`, `commit-convention.md`, `docs/sprints/*`
4. Accepted ADRs in `docs/adr/` when present

If a task conflicts with docs, **stop and update/request docs (or ADR)**—do not code around the conflict.

## Non-negotiables

- **Organization isolation:** never use `X-Tenant-ID` / caller-selected org headers; derive org from authenticated organization-scoped session/JWT.
- **Vocabulary:** Organization, Resident, Lease, Unit, Bed, Property Owner — never Room-as-Unit or renter-as-tenant in APIs/UI.
- **Money:** decimal strings + ISO currency; no JS float for currency.
- **Modular monolith:** Nest modules with `presentation → application → domain`; Prisma only in infrastructure/repos.
- **Outbox:** DB commit + durable outbox in one transaction for async side effects.
- **Frontend stack:** Next.js App Router + TanStack Query + Zustand + Tailwind semantic tokens (`packages/ui`).
- **Tokens:** never store access/refresh tokens in `localStorage` / `sessionStorage` / IndexedDB / readable cookies / persisted stores.
- **Errors:** RFC 9457 `application/problem+json` via central mapper only.
- **Tests:** Organization isolation negative tests are a merge gate for org-owned repos/endpoints.

## How to implement

1. Identify owning domain module (`tenancy`, `inventory`, `leasing`, `billing`, …).
2. Prefer extending existing module boundaries; do not create a generic `organizations` module.
3. Put Nest use cases in `application/`, invariants in `domain/`, Prisma in `infrastructure/`.
4. Put Next.js routes in `apps/web/src/app` (thin) and domain UI in `apps/web/src/features/<domain>`.
5. Share transport types via `packages/contracts`—not by importing apps into packages.
6. Add/adjust Prisma migrations with expand/migrate/contract for breaking changes; never edit applied migrations.
7. Update OpenAPI/contracts when APIs change; update UI docs when screens change.
8. Run `pnpm lint`, `pnpm typecheck`, `pnpm build` (and Prisma validate) before finishing.

## Git discipline

- Conventional Commits only (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `revert`).
- Branch: `<type>/<ticket>-<short-kebab>`.
- Do not commit `.env`, secrets, or credentials.
- Do not use `--no-verify` unless explicitly instructed for an approved emergency.
- Do not create remotes or push unless the user asks.

## PR / review readiness

Before claiming done, satisfy the checklists in [`CODING_RULES.md`](./CODING_RULES.md) §§17–18 and fill `.github/pull_request_template.md` fields when opening a PR.

## Explicitly out of scope unless asked

- Creating GitHub remotes or changing git config
- Business CRUD outside the active sprint
- Drive-by refactors unrelated to the task
- Waiving isolation, auth, or money rules for convenience
