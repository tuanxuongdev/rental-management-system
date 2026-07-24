# Prisma

Single source of truth for relational persistence.

## Layout

```text
prisma/
  schema/
    base.prisma          # generator + datasource
    platform.prisma      # Sprint-02 platform durability tables
    migrations/          # immutable forward-only migrations
  raw-sql/               # reviewed PostgreSQL-only DDL fragments
```

## Commands

```bash
pnpm prisma:generate
pnpm prisma:validate
pnpm prisma:migrate:deploy   # aka pnpm db:migrate
pnpm prisma:migrate:status   # aka pnpm db:status
```

Local Postgres (Docker Compose) listens on **host port 5433** to avoid conflicts with other installations. Full setup: [`docs/local-development.md`](../docs/local-development.md).

## Local bootstrap seed

```bash
pnpm seed:local-bootstrap
# defaults: owner@localhost.dev / LocalDevPassword123!
```

## Demo portfolio seed (Sprint-05)

Synthetic apartment + boarding-house inventory for local/staging demos:

```bash
DEMO_ORGANIZATION_ID=<organization-uuid> pnpm seed:demo-portfolio
```

Property Owner and Management Agreement rows are commercial facts only — they never create memberships or login access.

## Sprint-02 platform tables

- `outbox_events`
- `processed_messages`
- `scheduled_jobs`
- `idempotency_keys`

Domain schemas (identity, inventory, leasing, …) are added in later sprints. Migrations are forward-only and immutable once applied.
