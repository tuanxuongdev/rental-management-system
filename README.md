# Rental Property Management

Production-oriented monorepo for a multi-tenant Rental Property Management SaaS (boarding houses and apartments).

Design documentation under [`docs/`](./docs) is normative. This repository currently ships an **infrastructure foundation** — no business domain features yet.

## License

MIT — see [`LICENSE`](./LICENSE).

## Stack

| Layer | Technology |
|---|---|
| Web | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui-style primitives, TanStack Query, Zustand, React Hook Form, Zod |
| API / Worker | NestJS, Prisma, PostgreSQL |
| Workspace | pnpm, Docker Compose, GitHub Actions, ESLint, Prettier, Husky, lint-staged, commitlint |

## Repository layout

```text
apps/web              Next.js application
apps/api              NestJS HTTP API
apps/worker           NestJS background worker
packages/ui           Shared UI primitives
packages/contracts    Shared Zod contracts
packages/config       Shared TypeScript configs
packages/testing      Shared test helpers
prisma/               Prisma schema and migrations
infrastructure/       Docker and deployment assets
docs/                 Product, architecture, and delivery docs
.github/              CI, templates, CODEOWNERS
```

## Prerequisites

- Node.js **20.11+**
- pnpm **9+** (`corepack enable`)
- Docker (optional, for Compose)

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

pnpm dev:web      # http://localhost:3000
pnpm dev:api      # http://localhost:3001/health
pnpm dev:worker
```

### Quality gates

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
```

Git hooks (Husky):

- `pre-commit` → lint-staged
- `commit-msg` → commitlint (Conventional Commits)

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md), [`docs/git-workflow.md`](./docs/git-workflow.md), and [`docs/commit-convention.md`](./docs/commit-convention.md).

Please follow the [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

## Security

Report vulnerabilities privately — see [`SECURITY.md`](./SECURITY.md).

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/00-overview.md`](./docs/00-overview.md) | Product vision |
| [`docs/project-roadmap.md`](./docs/project-roadmap.md) | Program roadmap |
| [`docs/dependency-map.md`](./docs/dependency-map.md) | Module/feature dependencies |
| [`docs/sprints/`](./docs/sprints/) | Sprint plans |
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
