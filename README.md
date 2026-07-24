# Rental Property Management

Production-oriented monorepo for a multi-tenant Rental Property Management SaaS (boarding houses and apartments).

Design documentation under [`docs/`](./docs) is normative. **Sprints 01–05 are implemented and reviewed** (platform → identity/RBAC → portfolio inventory). The next planned increment is **[Sprint-06](./docs/sprints/Sprint-06.md)** (bulk inventory import and 10k scale baseline toward **M3**). See [`docs/reviews/Mid-Project-Audit.md`](./docs/reviews/Mid-Project-Audit.md) for the mid-program health check.

## License

MIT — see [`LICENSE`](./LICENSE).

## Stack

| Layer | Technology |
|---|---|
| Web | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui-style primitives, TanStack Query, Zod |
| API / Worker | NestJS, Prisma, PostgreSQL, Redis (optional) |
| Workspace | pnpm, Docker Compose, GitHub Actions, ESLint, Prettier, Husky, lint-staged, commitlint, Vitest |

## Repository layout

```text
apps/web              Next.js application
apps/api              NestJS HTTP API
apps/worker           NestJS background worker
packages/ui           Shared UI primitives
packages/contracts    Shared Zod contracts
packages/config       Shared TypeScript configs
packages/testing      Shared test helpers
prisma/               Prisma split schema + platform migrations (Sprint-02)
infrastructure/       Docker and deployment assets
docs/                 Product, architecture, ADRs, runbooks
.github/              CI, deploy-dev, templates, CODEOWNERS
```

## Prerequisites

- Node.js **20.11+**
- pnpm **9+** (`corepack enable`)
- Docker (for local Postgres / Redis / MinIO)

**Full local setup:** [`docs/local-development.md`](./docs/local-development.md)

## Quick start

```bash
cp .env.example .env
pnpm setup:local
pnpm docker:deps
pnpm db:migrate
pnpm seed:local-bootstrap

pnpm dev:api      # http://localhost:3001/health
pnpm dev:worker   # http://localhost:3002/health
pnpm dev:web      # http://localhost:3000
```

Default bootstrap login: `owner@localhost.dev` / `LocalDevPassword123!` (then create an Organization at `/onboarding/organization`).

Or run dependencies + apps entirely in Compose:

```bash
pnpm db:migrate
pnpm docker:up
```

### Local development (hybrid)

```bash
pnpm docker:deps
pnpm prisma:migrate:deploy

pnpm dev:api      # http://localhost:3001/health
pnpm dev:web      # http://localhost:3000/status
pnpm dev:worker   # health http://localhost:3002/health
```

### API endpoints (foundation + current domains)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | API liveness |
| `GET` | `/ready` | API readiness (configuration + PostgreSQL; Redis skipped if unset) |
| `GET` | `/v1/meta/*` | Version, ping, pagination/operations skeletons, idempotent echo (demo gated) |
| `POST` | `/v1/auth/*` | Login, refresh, logout, MFA, invitations, organization switch |
| `GET` | `/v1/me` | Current user, memberships, effective permissions |
| `*` | `/v1/organizations/{organizationId}/*` | Org admin (members, roles, settings) + portfolio inventory/parties |
| `GET` | `http://localhost:3002/health` | Worker health |

Domain route inventories and permissions: [`docs/04-api-specification.md`](./docs/04-api-specification.md), [`docs/06-permission-system.md`](./docs/06-permission-system.md), sprint implementation reviews under [`docs/reviews/`](./docs/reviews/).

### Quality gates

```bash
pnpm format:check
pnpm lint
pnpm boundaries
pnpm typecheck
pnpm unit
pnpm integration
pnpm sca
pnpm build
pnpm prisma:validate
pnpm prisma:migrate:status
```

Git hooks (Husky):

- `pre-commit` → lint-staged
- `commit-msg` → commitlint (Conventional Commits)

### CI/CD

- **CI** (`.github/workflows/ci.yml`): format, lint, boundaries, typecheck, build, migrate deploy/status, unit, integration (PostgreSQL), SCA, secret scan, container scan, commitlint
- **Deploy Development** (`.github/workflows/deploy-dev.yml`): builds Compose stack on `main`, smoke-tests health/meta/web/worker
- **Deploy Staging** (`.github/workflows/deploy-staging.yml`): staging Compose parity smoke including idempotent echo

Demo checklist: [`docs/runbooks/sprint-01-demo-checklist.md`](./docs/runbooks/sprint-01-demo-checklist.md)

### Operations runbooks

| Runbook | Purpose |
|---|---|
| [`docs/runbooks/incident.md`](./docs/runbooks/incident.md) | Incident response skeleton |
| [`docs/runbooks/migration.md`](./docs/runbooks/migration.md) | Database migration procedure |
| [`docs/runbooks/restore.md`](./docs/runbooks/restore.md) | Backup restore procedure |
| [`docs/runbooks/deployment.md`](./docs/runbooks/deployment.md) | Deployment procedure |
| [`docs/runbooks/restore-rehearsal-record.md`](./docs/runbooks/restore-rehearsal-record.md) | Restore rehearsal evidence template |

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`CODING_RULES.md`](./CODING_RULES.md), [`docs/git-workflow.md`](./docs/git-workflow.md), and [`docs/commit-convention.md`](./docs/commit-convention.md).

Please follow the [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately — see [`SECURITY.md`](./SECURITY.md).

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/local-development.md`](./docs/local-development.md) | Local install, Docker deps, migrate, seed, run apps |
| [`docs/00-overview.md`](./docs/00-overview.md) | Product vision |
| [`docs/project-roadmap.md`](./docs/project-roadmap.md) | Program roadmap |
| [`docs/reviews/Mid-Project-Audit.md`](./docs/reviews/Mid-Project-Audit.md) | Mid-project architecture / readiness audit |
| [`docs/sprints/Sprint-06.md`](./docs/sprints/Sprint-06.md) | Historical sprint (import + scale) |
| [`docs/sprints/Sprint-05.md`](./docs/sprints/Sprint-05.md) | Portfolio inventory sprint |
| [`docs/adr/README.md`](./docs/adr/README.md) | Architecture decision records |
| [`docs/git-workflow.md`](./docs/git-workflow.md) | Branching and PR workflow |
| [`docs/commit-convention.md`](./docs/commit-convention.md) | Conventional Commits |

## Path aliases

| Alias | Location |
|---|---|
| `@/*` | `apps/web/src/*` |
| `@rpm/ui` | `packages/ui` |
| `@rpm/contracts` | `packages/contracts` |

## Notes

- Access tokens must never be stored in `localStorage` / `sessionStorage`.
- `X-Tenant-ID` / `X-Organization-ID` are rejected by the API.
- Implement only the active sprint scope; do not invent ahead-of-sprint business CRUD.
- Quality gates also include `pnpm isolation` (Organization isolation / portfolio authz suite).
