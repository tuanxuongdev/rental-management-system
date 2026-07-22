# Rental Property Management

Production-oriented monorepo for a multi-tenant Rental Property Management SaaS (boarding houses and apartments).

Design documentation under [`docs/`](./docs) is normative. **Sprint-02** (current) delivers the data and operational foundation — Prisma platform migrations, outbox/idempotency, API envelopes, staging deploy, integration tests, and runbooks. **Sprint-01** established the monorepo, health/meta endpoints, CI/CD, and web status slice.

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
- Docker (optional, for Compose and deploy-dev workflow locally)

## Quick start

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm build
```

### Local development

```bash
docker compose -f infrastructure/docker/docker-compose.yml up postgres redis -d
pnpm prisma:migrate:deploy

pnpm dev:api      # http://localhost:3001/health
pnpm dev:web      # http://localhost:3000/status
pnpm dev:worker   # health http://localhost:3002/health
```

Or run the full stack:

```bash
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

### API endpoints (Sprint-01 + Sprint-02)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | API liveness |
| `GET` | `/ready` | API readiness (configuration + PostgreSQL; Redis skipped if unset) |
| `GET` | `/v1/meta/version` | Build version + git SHA |
| `GET` | `/v1/meta/ping` | Sample JSON ping for web→API demo |
| `GET` | `/v1/meta/pagination-example` | Empty cursor pagination envelope |
| `GET` | `/v1/meta/operations` | Empty operations skeleton |
| `POST` | `/v1/meta/idempotent-echo` | Idempotent echo demo (`Idempotency-Key` required) |
| `GET` | `http://localhost:3002/health` | Worker health |

Send `X-Request-ID` on API requests; the same value is returned on the response and echoed in ping JSON for trace correlation.

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
| [`docs/00-overview.md`](./docs/00-overview.md) | Product vision |
| [`docs/project-roadmap.md`](./docs/project-roadmap.md) | Program roadmap |
| [`docs/sprints/Sprint-02.md`](./docs/sprints/Sprint-02.md) | Current sprint scope (M1 data/ops foundation) |
| [`docs/sprints/Sprint-01.md`](./docs/sprints/Sprint-01.md) | Sprint-01 foundation |
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
- `X-Tenant-ID` is rejected by the API auth skeleton.
- Do not implement business CRUD until the corresponding sprint is in progress.
