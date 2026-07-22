# Database Migration Runbook (Skeleton)

**Status:** Sprint-02 skeleton  
**Owner:** Backend platform

## Principles

- Migrations are **forward-only** and immutable once merged.
- Schema changes flow through `prisma/schema/` and `prisma/schema/migrations/`.
- Expand → migrate → contract for breaking changes (future domain work).

## Local workflow

```bash
docker compose -f infrastructure/docker/docker-compose.yml up postgres -d
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm prisma:migrate:status
```

## CI / staging

1. `pnpm prisma:validate`
2. `pnpm prisma:migrate:deploy` against target database
3. Run `pnpm integration` and deploy smoke tests

## Rollback

- Do **not** edit applied migration files.
- Prefer forward-fix migration or feature toggle.
- Document rollback decision in PR and incident record.

## Raw SQL policy

PostgreSQL-only DDL not expressible in Prisma belongs in `prisma/raw-sql/` and is copied into an ordered migration with review. See ADR-0003.
