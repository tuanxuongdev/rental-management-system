# Contributing

Thanks for contributing to **Rental Property Management**.

This repository is a `pnpm` monorepo. Product and engineering documentation under [`docs/`](./docs) is normative. Do not redesign architecture, database design, API contracts, or UI specifications without an approved documentation change.

## Before you start

1. Read [`README.md`](./README.md), [`docs/git-workflow.md`](./docs/git-workflow.md), and [`docs/commit-convention.md`](./docs/commit-convention.md).
2. Follow [`docs/09-coding-standard.md`](./docs/09-coding-standard.md).
3. Use Node.js 20+ and pnpm 9+ (`corepack enable`).
4. Copy `.env.example` to `.env` for local development. Never commit secrets.

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

## Branching

Create a focused branch from `main`:

```text
feat/RPM-123-short-description
fix/RPM-456-short-description
chore/RPM-789-short-description
hotfix/RPM-101-critical-description
```

See [`docs/git-workflow.md`](./docs/git-workflow.md).

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

Husky runs:

- **pre-commit:** `lint-staged` (ESLint + Prettier on staged files)
- **commit-msg:** `commitlint` (Conventional Commits)

## Pull requests

1. Keep PRs small and independently reviewable.
2. Fill out the pull request template.
3. Ensure CI is green (`format`, `lint`, `typecheck`, `prisma validate`, `build`).
4. Call out security, Organization isolation, migration, and rollback impact.
5. Prefer squash merge into `main` unless repository policy says otherwise.

Do not open PRs that implement business features against unfinished sprint scope unless that sprint is the agreed target.

## Code of conduct and security

- Participate under [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- Report vulnerabilities privately per [`SECURITY.md`](./SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the MIT License ([`LICENSE`](./LICENSE)).
